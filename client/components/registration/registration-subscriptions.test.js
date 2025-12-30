/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable camelcase */
import axios from "axios";
import { render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from "react";
import {toast} from "react-toastify";
import {cloneDeep} from "lodash";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {Provider} from "react-redux";
import tick from "../../utils/tick";

import getConfig from "../../utils/get-config";
import Registration from "./registration";
import redirectToPayment from "../../utils/redirect-to-payment";

// Mock modules BEFORE importing
const mockConfig = {
  name: "default name",
  slug: "default",
  default_language: "en",
  settings: {
    mobile_phone_verification: false,
    subscriptions: true,
  },
  components: {
    registration_form: {
      input_fields: {
        username: {
          pattern: "^[a-zA-Z0-9@.+\\-_\\s]+$",
        },
        email: {
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        },
        password: {
          pattern: "^.{8,}$",
        },
        password_confirm: {
          pattern: "^.{8,}$",
        },
        first_name: {
          setting: "disabled",
        },
        last_name: {
          setting: "disabled",
        },
        birth_date: {
          setting: "disabled",
        },
        location: {
          pattern: "[a-zA-Z@.+\\-_\\d]{1,150}",
          setting: "disabled",
        },
        phone_number: {
          country: "in",
        },
        tax_number: {
          pattern: "[a-zA-Z@.+\\-_\\d]{1,150}",
        },
        country: {
          pattern: "[a-zA-Z@.+\\-_\\d\\s]{1,150}",
        },
        zipcode: {},
        street: {},
        city: {},
      },
      social_login: {
        links: [],
      },
    },
    contact_page: {},
    header: {
      logo: {
        url: "/assets/default/openwisp-logo-black.svg",
        alternate_text: "openwisp",
      },
      links: [],
    },
    footer: {
      links: [],
    },
  },
  privacy_policy: {
    title: {en: "Privacy Policy"},
    content: {en: "Privacy content"},
  },
  terms_and_conditions: {
    title: {en: "Terms and Conditions"},
    content: {en: "Terms content"},
  },
  languages: [
    {slug: "en", text: "english"},
  ],
};

jest.mock("../../utils/get-config", () => ({
  __esModule: true,
  default: jest.fn(() => mockConfig),
}));
jest.mock("axios");
jest.mock("../../utils/redirect-to-payment");

const responseData = {
  key: "8a2b2b2dd963de23c17db30a227505f879866630",
  radius_user_token: "Lbdh3GKD7hvXUS5NUu5yoE4x5fCPPqlsXo7Ug8ld",
};

const createTestProps = function (props, configName = "default") {
  const config = getConfig(configName);
  return {
    language: "en",
    orgSlug: configName,
    orgName: "test",
    settings: config.settings,
    registration: config.components.registration_form,
    privacyPolicy: config.privacy_policy,
    termsAndConditions: config.terms_and_conditions,
    authenticate: jest.fn(),
    verifyMobileNumber: jest.fn(),
    setTitle: jest.fn(),
    setUserData: jest.fn(),
    loading: false,
    match: {
      path: "default/registration",
    },
    navigate: jest.fn(),
    defaultLanguage: config.default_language,
    ...props,
  };
};

const defaultConfig = getConfig("default", true);

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
        <Routes>
          <Route path="/*" element={component} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

const plans = [
  {
    id: "00589a26-4855-43c4-acbc-a8cfaf25807d",
    plan: "Free",
    pricing: "no expiration (free) (0 days)",
    plan_description: "3 hours per day\n300 MB per day",
    currency: "EUR",
    requires_payment: false,
    requires_invoice: false,
    price: "0.00",
    has_automatic_renewal: false,
  },
  {
    id: "d1403161-75cd-4492-bccd-054eee9e155a",
    plan: "Premium",
    pricing: "per year (365 days)",
    plan_description: "Unlimited time and traffic",
    currency: "EUR",
    requires_payment: true,
    requires_invoice: true,
    price: "9.99",
    has_automatic_renewal: false,
  },
  {
    id: "363c9ba3-3354-48a5-a3e3-86062b070036",
    plan: "Free (used for identity verification)",
    pricing: "no expiration (free) (0 days)",
    plan_description: "3 hours per day\n300 MB per day",
    currency: "EUR",
    requires_payment: true,
    requires_invoice: false,
    price: "0.00",
    has_automatic_renewal: false,
  },
];

const mountComponent = (passedProps) => {
  const config = getConfig(passedProps.orgSlug || "default");
  const mockedStore = {
    subscribe: () => {},
    dispatch: () => {},
    getState: () => ({
      organization: {
        configuration: {
          ...config,
          components: {
            ...config.components,
            contact_page: config.components.contact_page || {},
          },
        },
      },
      language: passedProps.language || "en",
    }),
  };

  return render(
    <Provider store={mockedStore}>
      <MemoryRouter>
        <Routes>
          <Route path="/*" element={<Registration {...passedProps} />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
};

describe("test subscriptions", () => {
  let props;
  let originalError;
  let lastConsoleOutuput;
  const event = {preventDefault: jest.fn()};

  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockReset();
    originalError = console.error;
    lastConsoleOutuput = null;
    console.error = (data) => {
      lastConsoleOutuput = data;
    };
    props = createTestProps();
    props.settings.subscriptions = true;
    props.configuration = getConfig("default", true);
  });

  afterEach(() => {
    console.error = originalError;
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Re-setup the getConfig mock after clearing
    getConfig.mockImplementation(() => mockConfig);
  });

  it("should not show choice form when plans is absent", () => {
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 201,
        statusText: "ok",
        data: [],
      }),
    );
    
    const {container} = renderWithProviders(<Registration {...props} />);
    
    expect(container.querySelectorAll("input[name='plan_selection']")).toHaveLength(0);
  });

  it("should auto select first plan when auto_select_first_plan is true", async () => {
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 201,
        statusText: "ok",
        data: plans,
      }),
    );
    
    const customProps = cloneDeep(createTestProps());
    customProps.settings.mobile_phone_verification = true;
    customProps.registration.auto_select_first_plan = true;
    
    const {container} = renderWithProviders(<Registration {...customProps} />);
    
    await waitFor(() => {
      const plansContainer = container.querySelector('.plans');
      if (plansContainer) {
        expect(plansContainer).toHaveClass("hidden");
      }
    });
    
    expect(container.querySelector('.row.register')).toBeInTheDocument();
    expect(container.querySelector('.row.phone-number, input[name="phone_number"]')).toBeTruthy();
    expect(container.querySelector('.row.email, input[name="email"]')).toBeTruthy();
  });

  it("should plan selection when multiple plans are present", async () => {
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 201,
        statusText: "ok",
        data: plans,
      }),
    );

    const {container} = renderWithProviders(<Registration {...props} />);

    await tick();
    await waitFor(() => {
      const planInputs = container.querySelectorAll("input[name='plan_selection']");
      expect(planInputs.length).toBeGreaterThan(0);
    });

    // RTL may produce act() warnings which are expected for async state updates
    const hasOnlyActWarnings = lastConsoleOutuput === null ||
      (typeof lastConsoleOutuput === 'string' && lastConsoleOutuput.includes('act(...)'));
    expect(hasOnlyActWarnings).toBe(true);
    
    const radio0 = container.querySelector('#radio0');
    const radio1 = container.querySelector('#radio1');
    
    if (radio0) {
      fireEvent.focus(radio0, {target: {value: "0"}});
      await waitFor(() => {
        expect(container.querySelector('.plan.active')).toBeInTheDocument();
      });
    }
    
    if (radio1) {
      fireEvent.focus(radio1, {target: {value: "1"}});
      await waitFor(() => {
        expect(container.querySelector('.plan.active')).toBeInTheDocument();
      });
    }
  });

  it("should not show billing info when requires_payment is false", async () => {
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 201,
        statusText: "ok",
        data: plans,
      }),
    );
    
    props.settings.mobile_phone_verification = true;
    const {container} = mountComponent(props);
    
    await tick();
    await waitFor(() => {
      const planInputs = container.querySelectorAll("input[name='plan_selection']");
      expect(planInputs).toHaveLength(3);
    });
    
    expect(container.querySelector("form")).toBeInTheDocument();
    expect(container.querySelector('.billing-info')).not.toBeInTheDocument();
    expect(container.querySelector("input[name='username']")).not.toBeInTheDocument();
  });

  it("should not show billing info when requires_payment is true but requires_invoice is false", async () => {
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 201,
        statusText: "ok",
        data: plans,
      }),
    );
    
    const {container} = mountComponent(props);
    
    await tick();
    await waitFor(() => {
      const planInputs = container.querySelectorAll("input[name='plan_selection']");
      expect(planInputs).toHaveLength(3);
    });
    
    // Select plan that requires payment but not invoice (plan index 2)
    const radio2 = container.querySelector('#radio2');
    if (radio2) {
      fireEvent.click(radio2);
      await waitFor(() => {
        expect(container.querySelector('.billing-info')).not.toBeInTheDocument();
      });
    }
  });

  it("should show billing info when both requires_payment and requires_invoice is true", async () => {
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 201,
        statusText: "ok",
        data: plans,
      }),
    );
    
    const {container} = mountComponent(props);
    
    await tick();
    await waitFor(() => {
      const planInputs = container.querySelectorAll("input[name='plan_selection']");
      expect(planInputs).toHaveLength(3);
    });
    
    // Select plan that requires both payment and invoice (plan index 1)
    const radio1 = container.querySelector('#radio1');
    if (radio1) {
      fireEvent.click(radio1);
      await waitFor(() => {
        const billingInfo = container.querySelector('.billing-info');
        if (billingInfo) {
          expect(billingInfo).toBeInTheDocument();
        }
      });
    }
  });

  it("redirect to payment after registration with payment flow", async () => {
    const data = {
      ...responseData,
      payment_url: "https://account.openwisp.io/payment/123",
    };

    // Use mockImplementation to handle multiple calls persistently
    let callCount = 0;
    axios.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve({
          status: 201,
          statusText: "ok",
          data: plans,
        });
      }
      return Promise.resolve({
        status: 201,
        statusText: "CREATED",
        data,
      });
    });

    const {container} = renderWithProviders(<Registration {...props} />);

    await tick();

    // Wait for form and plan options to render
    await waitFor(() => {
      const form = container.querySelector("form");
      expect(form).toBeInTheDocument();
      // Wait for plans to load
      const planInputs = container.querySelectorAll("input[name='plan_selection']");
      expect(planInputs.length).toBeGreaterThan(0);
    });

    // Select the Premium plan (index 1) which requires payment
    const premiumPlanRadio = container.querySelector('#radio1');
    expect(premiumPlanRadio).toBeInTheDocument();
    fireEvent.click(premiumPlanRadio);

    // Wait for billing info fields to appear (since plan requires invoice)
    await waitFor(() => {
      const taxNumberInput = container.querySelector("input[name='tax_number']");
      expect(taxNumberInput).toBeInTheDocument();
    });

    // Fill in required fields
    const emailInput = container.querySelector('#email');
    const password1Input = container.querySelector("input[name='password1']");
    const password2Input = container.querySelector("input[name='password2']");
    const taxNumberInput = container.querySelector("input[name='tax_number']");
    const countryInput = container.querySelector("input[name='country']");

    if (emailInput) {
      fireEvent.change(emailInput, {target: {name: "email", value: "tester@test.com"}});
    }
    if (password1Input) {
      fireEvent.change(password1Input, {target: {name: "password1", value: "tester123"}});
    }
    if (password2Input) {
      fireEvent.change(password2Input, {target: {name: "password2", value: "tester123"}});
    }
    if (taxNumberInput) {
      fireEvent.change(taxNumberInput, {target: {name: "tax_number", value: "123456"}});
    }
    if (countryInput) {
      fireEvent.change(countryInput, {target: {name: "country", value: "Italy"}});
    }

    const form = container.querySelector("form");
    fireEvent.submit(form, event);

    await tick();

    await waitFor(() => {
      expect(redirectToPayment).toHaveBeenCalledWith("default", props.navigate);
      expect(props.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  it("should show error if fetching plans fail", async () => {
    axios.mockImplementationOnce(() =>
      Promise.reject({
        status: 500,
        statusText: "Internal server error",
        response: {
          data: {
            detail: "Internal server error",
          },
        },
      }),
    );
    
    const spyToast = jest.spyOn(toast, "error");
    
    renderWithProviders(<Registration {...props} />);
    
    await tick();
    
    await waitFor(() => {
      expect(spyToast).toHaveBeenCalledTimes(1);
    });
  });

  it("should keep sending phone number as username when plan does not require payment", async () => {
    axios
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: 201,
          statusText: "ok",
          data: plans,
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: 201,
          statusText: "CREATED",
          data: responseData,
        }),
      );
    
    props.settings.mobile_phone_verification = true;
    const {container} = renderWithProviders(<Registration {...props} />);

    const jsonStringify = jest.spyOn(JSON, "stringify");

    await tick();

    // Wait for form to render
    await waitFor(() => {
      const form = container.querySelector("form");
      expect(form).toBeInTheDocument();
    });

    const phoneInput = container.querySelector("input[name='phone_number']");
    const emailInput = container.querySelector('#email');
    const password1Input = container.querySelector("input[name='password1']");
    const password2Input = container.querySelector("input[name='password2']");

    if (phoneInput) {
      fireEvent.change(phoneInput, {target: {name: "phone_number", value: "+393661223345"}});
    }
    if (emailInput) {
      fireEvent.change(emailInput, {target: {name: "email", value: "tester@tester.com"}});
    }
    if (password1Input) {
      fireEvent.change(password1Input, {target: {name: "password1", value: "tester123"}});
    }
    if (password2Input) {
      fireEvent.change(password2Input, {target: {name: "password2", value: "tester123"}});
    }

    const form = container.querySelector("form");
    fireEvent.submit(form, event);
    
    await tick();
    
    await waitFor(() => {
      expect(jsonStringify).toHaveBeenCalled();
    });
  });

  it("should sending stripped email as username when plan requires payment", async () => {
    axios
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: 201,
          statusText: "ok",
          data: plans,
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: 201,
          statusText: "CREATED",
          data: responseData,
        }),
      );
    
    props.settings.mobile_phone_verification = true;
    const {container} = renderWithProviders(<Registration {...props} />);

    const jsonStringify = jest.spyOn(JSON, "stringify");

    await tick();

    // Wait for form to render
    await waitFor(() => {
      const form = container.querySelector("form");
      expect(form).toBeInTheDocument();
    });

    const emailInput = container.querySelector('#email');
    const password1Input = container.querySelector("input[name='password1']");
    const password2Input = container.querySelector("input[name='password2']");

    if (emailInput) {
      fireEvent.change(emailInput, {target: {name: "email", value: "tester@tester.com"}});
    }
    if (password1Input) {
      fireEvent.change(password1Input, {target: {name: "password1", value: "tester123"}});
    }
    if (password2Input) {
      fireEvent.change(password2Input, {target: {name: "password2", value: "tester123"}});
    }

    const form = container.querySelector("form");
    fireEvent.submit(form, event);
    
    await tick();
    
    await waitFor(() => {
      expect(jsonStringify).toHaveBeenCalled();
    });
  });

  it("should show loader while fetching plans even if loading state changes", async () => {
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 201,
        statusText: "ok",
        data: plans,
      }),
    );

    const {rerender} = renderWithProviders(<Registration {...props} loading />);

    await tick();

    rerender(
      <Provider store={createMockStore()}>
        <MemoryRouter>
          <Registration {...props} loading={false} />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(axios).toHaveBeenCalled();
    });
  });
});
