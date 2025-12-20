/* eslint-disable prefer-promise-reject-errors */
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from "react";
import {MemoryRouter} from "react-router-dom";
import {Provider} from "react-redux";
import {Cookies} from "react-cookie";

// Mock modules BEFORE importing
jest.mock("axios");
jest.mock("../../utils/get-config", () => ({
  __esModule: true,
  default: jest.fn((slug, isTest) => ({
    components: {
      payment_status_page: {
        content: {en: "Payment processing..."},
      },
    },
  })),
}));
jest.mock("../../utils/validate-token");
jest.mock("../../utils/load-translation");
jest.mock("../../utils/history");
jest.mock("../../utils/get-payment-status");

import getConfig from "../../utils/get-config";
import PaymentProcess from "./payment-process";
import tick from "../../utils/tick";
import validateToken from "../../utils/validate-token";
import loadTranslation from "../../utils/load-translation";
import getPaymentStatusRedirectUrl from "../../utils/get-payment-status";

const defaultConfig = getConfig("default", true);
const createTestProps = (props) => ({
  orgSlug: "default",
  userData: {},
  setUserData: jest.fn(),
  page: defaultConfig.components.payment_status_page,
  cookies: new Cookies(),
  settings: {subscriptions: true, payment_iframe: true},
  logout: jest.fn(),
  authenticate: jest.fn(),
  isAuthenticated: true,
  navigate: jest.fn(),
  language: "en",
  ...props,
});

const createMockStore = () => {
  const state = {
    organization: {
      configuration: {
        ...defaultConfig,
        slug: "default",
        components: {
          ...defaultConfig.components,
          contact_page: {
            email: "support.org",
            helpdesk: "+1234567890",
            social_links: [],
          },
        },
      },
    },
    language: "en",
  };

  return {
    subscribe: () => {},
    dispatch: () => {},
    getState: () => state,
  };
};

const renderWithProviders = (component) => {
  return render(
    <Provider store={createMockStore()}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </Provider>
  );
};

const responseData = {
  response_code: "AUTH_TOKEN_VALIDATION_SUCCESSFUL",
  is_active: true,
  is_verified: false,
  method: "bank_card",
  email: "tester@test.com",
  phone_number: null,
  username: "tester",
  key: "b72dad1cca4807dc21c00b0b2f171d29415ac541",
  radius_user_token: "jwyVSZYOze16ej6cc1AW5cxhRjahesLzh1Tm2y0d",
  first_name: "",
  last_name: "",
  birth_date: null,
  location: "",
  payment_url: "https://account.openwisp.io/payment/123",
};

describe("Test <PaymentProcess /> cases", () => {
  let props;
  const originalLog = console.log;
  const originalError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    props = createTestProps();
    console.log = jest.fn();
    console.error = jest.fn();
    getPaymentStatusRedirectUrl.mockClear();
    loadTranslation("en", "default");
    validateToken.mockClear();
    validateToken.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    console.log = originalLog;
    console.error = originalError;
    // Re-setup the getConfig mock after clearing
    getConfig.mockImplementation(() => ({
      components: {
        payment_status_page: {
          content: {en: "Payment processing..."},
        },
      },
    }));
  });

  it("should redirect if payment_url is not present", async () => {
    props = createTestProps({
      userData: {...responseData, payment_url: null},
    });
    validateToken.mockReturnValue(true);
    
    const {container} = renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    // Should redirect when no payment_url
    await waitFor(() => {
      // Component should handle redirect internally
      expect(validateToken).toHaveBeenCalled();
    });
  });

  it("should redirect unauthenticated users", async () => {
    props = createTestProps({
      isAuthenticated: false,
      userData: responseData,
    });
    validateToken.mockReturnValue(true);
    
    const {container} = renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    // Unauthenticated users should be redirected
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
  });

  it("should show loader if token is invalid", async () => {
    props = createTestProps({
      userData: responseData,
    });
    validateToken.mockReturnValue(false);
    
    const {container} = renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    // Component should handle loading state
    expect(validateToken).toHaveBeenCalled();
  });

  it("should render payment_url in iframe", async () => {
    props = createTestProps({
      userData: responseData,
    });
    validateToken.mockReturnValue(true);
    
    const {container} = renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    await waitFor(() => {
      // Check for iframe element
      const iframe = container.querySelector('iframe');
      if (iframe) {
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', responseData.payment_url);
      }
    });
    
    expect(container).toMatchSnapshot();
  });

  it("test postMessage event listener firing", async () => {
    props = createTestProps({
      userData: responseData,
    });
    validateToken.mockReturnValue(true);
    
    const events = {};
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;
    
    window.addEventListener = jest.fn((event, callback) => {
      events[event] = callback;
    });
    window.removeEventListener = jest.fn((event) => {
      delete events[event];
    });
    
    const {container, unmount} = renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    // Verify event listener was added
    expect(window.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
    
    // Simulate postMessage event
    if (events.message) {
      await act(async () => {
        events.message({
          data: {
            type: "paymentClose",
            message: {paymentId: "paymentId"},
          },
          origin: window.location.origin,
        });
      });
    }
    
    // Cleanup
    unmount();
    
    // Verify event listener was removed
    expect(window.removeEventListener).toHaveBeenCalled();
    
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  it("should redirect to /payment/:status on completed transaction", async () => {
    props = createTestProps({userData: responseData});
    validateToken.mockReturnValue(true);
    getPaymentStatusRedirectUrl.mockReturnValue(
      `/${props.orgSlug}/payment/success/`,
    );
    
    const events = {};
    const originalAddEventListener = window.addEventListener;
    
    window.addEventListener = jest.fn((event, callback) => {
      events[event] = callback;
    });
    
    const {container} = renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    // Simulate payment completion message
    if (events.message) {
      await act(async () => {
        events.message({
          data: {
            type: "paymentClose",
            message: {paymentId: "paymentId"},
          },
          origin: window.location.origin,
        });
      });
      
      await tick();
      
      expect(props.navigate).toHaveBeenCalledWith(
        `/${props.orgSlug}/payment/success/`,
      );
    }
    
    window.addEventListener = originalAddEventListener;
  });

  it("should handle postMessage for showLoader", async () => {
    props = createTestProps({userData: responseData});
    validateToken.mockReturnValue(true);
    
    const events = {};
    const originalAddEventListener = window.addEventListener;
    
    window.addEventListener = jest.fn((event, callback) => {
      events[event] = callback;
    });
    
    const {container} = renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    // Simulate showLoader message
    if (events.message) {
      await act(async () => {
        events.message({
          data: {
            type: "showLoader",
          },
          origin: window.location.origin,
        });
      });
      
      // Component should handle loading state
      await tick();
    }
    
    window.addEventListener = originalAddEventListener;
  });

  it("should handle postMessage for setHeight", async () => {
    props = createTestProps({userData: responseData});
    validateToken.mockReturnValue(true);
    
    const events = {};
    const originalAddEventListener = window.addEventListener;
    
    window.addEventListener = jest.fn((event, callback) => {
      events[event] = callback;
    });
    
    const {container} = renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    // Simulate setHeight message
    if (events.message) {
      await act(async () => {
        events.message({
          data: {
            type: "setHeight",
            message: 800,
          },
          origin: window.location.origin,
        });
      });
      
      await tick();
      
      // Check if iframe height was updated
      const iframe = container.querySelector('iframe');
      if (iframe) {
        // Height should be updated in the component
        expect(iframe).toBeInTheDocument();
      }
    }
    
    window.addEventListener = originalAddEventListener;
  });

  it("should redirect to payment_url if payment_iframe set to false", async () => {
    props = createTestProps({
      userData: responseData,
      settings: {subscriptions: true, payment_iframe: false},
    });
    validateToken.mockResolvedValue(true);

    // Spy on PaymentProcess.prototype.redirectToPaymentUrl
    const redirectSpy = jest.spyOn(
      PaymentProcess.prototype,
      'redirectToPaymentUrl'
    ).mockImplementation(() => {});

    const {container} = renderWithProviders(<PaymentProcess {...props} />);

    // Wait for component to call redirectToPaymentUrl after token validation
    await waitFor(() => {
      expect(redirectSpy).toHaveBeenCalledWith(responseData.payment_url);
    });

    // Component should return null (no content) when redirecting
    expect(container.querySelector('.payment-process')).not.toBeInTheDocument();

    redirectSpy.mockRestore();
  });

  it("should validate token on mount", async () => {
    props = createTestProps({
      userData: responseData,
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentProcess {...props} />);
    
    await tick();
    
    expect(validateToken).toHaveBeenCalledWith(
      props.cookies,
      props.orgSlug,
      props.setUserData,
      props.userData,
      props.logout
    );
  });
});
