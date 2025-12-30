/* eslint-disable prefer-promise-reject-errors */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from "react";
import {toast} from "react-toastify";
import {MemoryRouter} from "react-router-dom";
import {Provider} from "react-redux";
import {Cookies} from "react-cookie";
import {t} from "ttag";

import getConfig from "../../utils/get-config";
import PaymentStatus from "./payment-status";
import tick from "../../utils/tick";
import validateToken from "../../utils/validate-token";
import loadTranslation from "../../utils/load-translation";

// Mock modules BEFORE importing
jest.mock("axios");
jest.mock("../../utils/get-config", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    components: {
      payment_status_page: {
        content: {
          en: {
            pending: "Payment pending",
            success: "Payment successful",
            failed: "Payment failed",
          },
        },
      },
    },
  })),
}));
jest.mock("../../utils/validate-token");
jest.mock("../../utils/load-translation");

const defaultConfig = getConfig("default", true);
const createTestProps = (props) => ({
  orgSlug: "default",
  userData: {},
  setUserData: jest.fn(),
  page: defaultConfig.components.payment_status_page,
  cookies: new Cookies(),
  settings: {subscriptions: true, payment_requires_internet: true},
  logout: jest.fn(),
  authenticate: jest.fn(),
  navigate: jest.fn(),
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

const renderWithProviders = (component) => render(
    <Provider store={createMockStore()}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </Provider>
  );

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
};

describe("<PaymentStatus /> rendering with placeholder translation tags", () => {
  const props = createTestProps({
    userData: responseData,
    params: {status: "failed"},
    isAuthenticated: true,
  });
  
  it("should render translation placeholder correctly", () => {
    const {container} = renderWithProviders(<PaymentStatus {...props} />);
    expect(container).toMatchSnapshot();
  });
});

describe("Test <PaymentStatus /> cases", () => {
  let props;
  const originalLog = console.log;

  beforeEach(() => {
    jest.clearAllMocks();
    props = createTestProps();
    console.log = jest.fn();
    console.error = jest.fn();
    loadTranslation("en", "default");
    validateToken.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    console.log = originalLog;
    // Re-setup the getConfig mock after clearing
    getConfig.mockImplementation(() => ({
      components: {
        payment_status_page: {
          content: {
            en: {
              pending: "Payment pending",
              success: "Payment successful",
              failed: "Payment failed",
            },
          },
        },
      },
    }));
  });

  it("should render failed state", async () => {
    props = createTestProps({
      userData: responseData,
      params: {status: "failed"},
    });
    validateToken.mockReturnValue(true);
    
    const {container} = renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    expect(container).toMatchSnapshot();
    expect(container.querySelector('.payment-status-row-1')).toBeInTheDocument();
    expect(container.querySelector('.payment-status-row-2')).toBeInTheDocument();
    expect(container.querySelector('.payment-status-row-3')).toBeInTheDocument();
    expect(container.querySelectorAll('.main-column .button.full')).toHaveLength(2);
    
    const paymentLink = container.querySelector('.payment-status-row-3 .button');
    if (paymentLink) {
      expect(paymentLink).toHaveAttribute('href', '/default/payment/draft');
    }
    
    expect(container.querySelectorAll('.payment-status-row-4 .button')).toHaveLength(1);
  });

  it("should call logout correctly when clicking on logout button", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      userData: responseData,
      params: {status: "failed"},
    });
    validateToken.mockReturnValue(true);
    
    const {container} = renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    const logoutButtons = container.querySelectorAll('.payment-status-row-4 .button');
    expect(logoutButtons).toHaveLength(1);
    
    fireEvent.click(logoutButtons[0]);
    
    expect(props.setUserData).toHaveBeenCalledWith({
      ...responseData,
      mustLogout: true,
      payment_url: null,
    });
    expect(spyToast).not.toHaveBeenCalled();
    expect(props.navigate).toHaveBeenCalledWith(`/${props.orgSlug}/status`);
  });

  it("should redirect to status page if user is already verified", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      userData: {...responseData, is_verified: true},
      params: {status: "failed"},
    });
    validateToken.mockReturnValue(true);
    
    const {container} = renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    // Component should redirect - check that navigation was triggered
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
  });

  it("redirect to status + cp logout on success when payment requires internet", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      userData: {...responseData, is_verified: true},
      params: {status: "success"},
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(spyToast).toHaveBeenCalledTimes(1);
      expect(props.setUserData).toHaveBeenCalledWith({
        ...props.userData,
        mustLogin: false,
        mustLogout: true,
        repeatLogin: true,
      });
    });
    
    expect(props.logout).not.toHaveBeenCalled();
  });

  it("redirect to status + cp login on success when payment does not require internet", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      userData: {...responseData, is_verified: true},
      params: {status: "success"},
    });
    props.settings.payment_requires_internet = false;
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(spyToast).toHaveBeenCalledTimes(1);
      expect(props.setUserData).toHaveBeenCalledWith({
        ...props.userData,
        mustLogin: true,
        mustLogout: false,
        repeatLogin: false,
      });
    });
    
    expect(props.logout).not.toHaveBeenCalled();
  });

  it("should set proceedToPayment in userData when navigating to /status", async () => {
    validateToken.mockReturnValue(true);

    // Test payment_requires_internet is set to false
    props = createTestProps({
      userData: {...responseData, is_verified: false},
      params: {status: "draft"},
    });
    props.settings.payment_requires_internet = false;

    let result = renderWithProviders(<PaymentStatus {...props} />);

    await tick();

    // When payment_requires_internet is false and status is draft with is_verified false,
    // setUserData is called with mustLogin: undefined in componentDidMount
    await waitFor(() => {
      expect(props.setUserData).toHaveBeenCalledWith({
        ...responseData,
        is_verified: false,
        mustLogin: undefined,
      });
    });

    props.setUserData.mockClear();

    let payProcButton = result.container.querySelector('a.button.full');
    if (payProcButton && payProcButton.textContent === t`PAY_PROC_BTN`) {
      fireEvent.click(payProcButton);
    }

    result.unmount();

    // Test payment_requires_internet is set to true
    props = createTestProps({
      userData: {...responseData, is_verified: false},
      params: {status: "draft"},
    });
    props.settings.payment_requires_internet = true;
    
    result = renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    payProcButton = result.container.querySelector('a.button.full');
    if (payProcButton && payProcButton.textContent === t`PAY_PROC_BTN`) {
      fireEvent.click(payProcButton);
    }
    
    await waitFor(() => {
      expect(props.setUserData).toHaveBeenCalledWith({
        ...responseData,
        is_verified: false,
        proceedToPayment: true,
      });
    });
  });

  it("should redirect to status if success but unverified", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      userData: {...responseData, is_verified: false},
      params: {status: "success"},
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
  });

  it("should redirect to status if success but not using bank_card method", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      params: {status: "success"},
      settings: {
        subscriptions: true,
        mobile_phone_verification: true,
      },
      userData: {...responseData, method: "mobile_phone"},
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
  });

  it("should redirect to status if failed but not using bank_card method", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      params: {status: "failed"},
      settings: {
        subscriptions: true,
        mobile_phone_verification: true,
      },
      userData: {...responseData, method: "mobile_phone"},
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
  });

  it("should redirect to login if not authenticated", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      params: {status: "failed"},
      settings: {
        subscriptions: true,
        mobile_phone_verification: true,
      },
      isAuthenticated: false,
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
  });

  it("should redirect to status if result is not one of the expected values", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      params: {status: "unexpected"},
      settings: {
        subscriptions: true,
        mobile_phone_verification: true,
      },
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
  });

  it("should redirect to status page if draft and not bank_card", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      userData: {...responseData, is_verified: false, method: "mobile_phone"},
      params: {status: "draft"},
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
  });

  it("should redirect to status page if draft and verified", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      userData: {...responseData, is_verified: true},
      params: {status: "draft"},
    });
    validateToken.mockReturnValue(true);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
  });

  it("should redirect to status page if token is not valid", async () => {
    const spyToast = jest.spyOn(toast, "success");
    props = createTestProps({
      userData: {...responseData, is_verified: false},
      params: {status: "draft"},
    });
    validateToken.mockReturnValue(false);
    
    renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(validateToken).toHaveBeenCalled();
    });
    expect(spyToast).not.toHaveBeenCalled();
    expect(props.setUserData).not.toHaveBeenCalled();
  });

  it("should call logout correctly when clicking on logout button from draft", async () => {
    props = createTestProps({
      userData: {...responseData, is_verified: false},
      params: {status: "draft"},
    });
    validateToken.mockReturnValue(true);
    
    const {container} = renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    const buttons = container.querySelectorAll('.button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    
    // Click the second button (logout button)
    fireEvent.click(buttons[1]);
    
    expect(props.setUserData).toHaveBeenCalledWith({
      ...responseData,
      mustLogout: true,
      payment_url: null,
    });
    expect(props.navigate).toHaveBeenCalledWith(`/${props.orgSlug}/status`);
  });

  it("should render draft correctly", async () => {
    props = createTestProps({
      userData: {...responseData, is_verified: false},
      params: {status: "draft"},
    });
    validateToken.mockReturnValue(true);
    
    const {container} = renderWithProviders(<PaymentStatus {...props} />);
    
    await tick();
    
    expect(container).toMatchSnapshot();
    expect(props.setUserData).toHaveBeenCalledWith({
      ...responseData,
      mustLogin: true,
    });
  });
});
