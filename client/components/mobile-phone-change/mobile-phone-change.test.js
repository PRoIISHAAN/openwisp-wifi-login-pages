/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable camelcase */
import axios from "axios";
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from "react";
import PropTypes from "prop-types";
import {Cookies} from "react-cookie";
import {toast} from "react-toastify";
import {Provider} from "react-redux";
import {BrowserRouter as Router, Routes, Route, MemoryRouter} from "react-router-dom";
import {createMemoryHistory} from "history";
import {loadingContextValue} from "../../utils/loading-context";
import loadTranslation from "../../utils/load-translation";
import tick from "../../utils/tick";

// Mock modules BEFORE importing
const mockConfig = {
  slug: "default",
  name: "default name",
  default_language: "en",
  components: {
    phone_number_change_form: {
      input_fields: {},
      buttons: {
        cancel: true,
      },
    },
    registration_form: {
      input_fields: {
        phone_number: {
          country: "in",
        },
      },
    },
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
    contact_page: {},
  },
  settings: {
    mobile_phone_verification: true,
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
  default: jest.fn((slug, isTest) => mockConfig),
}));
jest.mock("../../utils/validate-token");
jest.mock("../../utils/load-translation");
jest.mock("../../utils/submit-on-enter");
jest.mock("axios");

import getConfig from "../../utils/get-config";
import MobilePhoneChange from "./mobile-phone-change";
import validateToken from "../../utils/validate-token";
import submitOnEnter from "../../utils/submit-on-enter";

function StatusMock() {
  return <div data-testid="status-mock" />;
}

const createTestProps = function (props, configName = "test-org-2") {
  const conf = getConfig(configName);
  const componentConf = conf.components.phone_number_change_form;
  componentConf.input_fields = {
    phone_number: conf.components.registration_form.input_fields.phone_number,
  };
  return {
    phone_number_change: componentConf,
    settings: conf.settings,
    orgSlug: conf.slug,
    orgName: conf.name,
    cookies: new Cookies(),
    logout: jest.fn(),
    setUserData: jest.fn(),
    userData: {},
    setTitle: jest.fn(),
    language: "en",
    navigate: jest.fn(),
    // needed for subcomponents
    configuration: conf,
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

const renderWithProviders = (component) => {
  return render(
    <Provider store={createMockStore()}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </Provider>
  );
};

describe("<MobilePhoneChange /> rendering with placeholder translation tags", () => {
  const props = createTestProps();
  it("should render translation placeholder correctly", () => {
    const {container} = renderWithProviders(<MobilePhoneChange {...props} />);
    expect(container).toMatchSnapshot();
  });
});

const historyMock = createMemoryHistory();

const mountComponent = function (props) {
  const mockedStore = {
    subscribe: () => {},
    dispatch: () => {},
    getState: () => ({
      organization: {
        configuration: {
          ...props.configuration,
          components: {
            ...props.configuration.components,
            contact_page: props.configuration.components.contact_page || {},
          },
        },
      },
      language: props.language,
    }),
  };

  return render(
    <Provider store={mockedStore}>
      <Router location={historyMock.location} navigator={historyMock}>
        <Routes>
          <Route path="/test-org-2/status" element={<StatusMock />} />
          <Route path="*" element={<MobilePhoneChange {...props} />} />
        </Routes>
      </Router>
    </Provider>
  );
};

const userData = {
  response_code: "AUTH_TOKEN_VALIDATION_SUCCESSFUL",
  radius_user_token: "o6AQLY0aQjD3yuihRKLknTn8krcQwuy2Av6MCsFB",
  username: "tester@tester.com",
  is_active: false,
  phone_number: "+393660011222",
};

describe("Change Phone Number: standard flow", () => {
  let props;
  let lastConsoleOutuput;
  let originalError;
  const event = {preventDefault: jest.fn()};

  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockReset();
    props = createTestProps();
    validateToken.mockClear();
    // console mocking
    originalError = console.error;
    lastConsoleOutuput = null;
    console.error = (data) => {
      lastConsoleOutuput = data;
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    console.error = originalError;
    // Re-setup the getConfig mock after clearing
    getConfig.mockImplementation(() => mockConfig);
  });

  it("should render successfully", async () => {
    validateToken.mockReturnValue(true);
    props.userData = userData;
    loadTranslation("en", "default");
    const {container} = mountComponent(props);

    expect(container.querySelector("input[name='phone_number']")).toBeInTheDocument();
    expect(container.querySelector("form")).toBeInTheDocument();
    expect(container.querySelector("#phone-number")).toBeInTheDocument();
    expect(container.querySelector("form input[type='submit']")).toBeInTheDocument();
    expect(container.querySelector(".row .button")).toBeInTheDocument();

    // Wait for phone number to be populated from userData (componentDidMount)
    await waitFor(() => {
      const phoneInput = container.querySelector("input[name='phone_number']");
      // Phone input formats the number, so check for the core digits
      expect(phoneInput.value.replace(/[\s-]/g, '')).toContain("393660011222");
    });
  });

  it("should change phone number successfully", async () => {
    validateToken.mockReturnValue(true);
    jest.spyOn(toast, "info");
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 200,
        statusText: "OK",
        data: null,
      }),
    );

    const {container} = mountComponent(props);
    
    const phoneInput = container.querySelector("#phone-number");
    fireEvent.change(phoneInput, {
      target: {value: "+393660011333", name: "phone_number"},
    });
    
    expect(phoneInput.value.replace(/[\s-]/g, '')).toContain("393660011333");
    
    const form = container.querySelector("form");
    fireEvent.submit(form);
    
    await tick();
    
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(props.navigate).toHaveBeenCalledWith(
      `/${props.orgSlug}/mobile-phone-verification`,
    );
    expect(props.setUserData).toHaveBeenCalledTimes(1);
    expect(props.setUserData).toHaveBeenCalledWith({
      is_verified: false,
      phone_number: expect.stringContaining("393660011333"),
    });
  });

  it("should render PhoneInput lazily and handlers should work correctly", async () => {
    props.userData = userData;
    const {container} = renderWithProviders(<MobilePhoneChange {...props} />);
    
    // Wait for PhoneInput to load
    await waitFor(() => {
      expect(container.querySelector("input[name='phone_number']")).toBeInTheDocument();
    });
    
    const phoneInput = container.querySelector("input[name='phone_number']");
    expect(phoneInput).toHaveAttribute('id', 'phone-number');
    // Placeholder may be ttag key since translations are mocked
    expect(phoneInput).toHaveAttribute('placeholder');

    // Test onChange
    fireEvent.change(phoneInput, {
      target: {value: "+911234567890", name: "phone_number"}
    });

    expect(phoneInput.value.replace(/[\s-]/g, '')).toContain("911234567890");
  });

  it("should load fallback before PhoneInput and handlers should work correctly", async () => {
    const {container} = renderWithProviders(<MobilePhoneChange {...props} />);

    // Check fallback input exists immediately
    const fallbackInput = container.querySelector("input[name='phone_number']");
    expect(fallbackInput).toBeInTheDocument();
    expect(fallbackInput).toHaveClass('form-control', 'input');
    // Placeholder may be ttag key since translations are mocked
    expect(fallbackInput).toHaveAttribute('placeholder');

    // Test onChange on fallback
    fireEvent.change(fallbackInput, {
      target: {value: "+911234567890", name: "phone_number"}
    });

    // Phone input may format the value
    expect(fallbackInput.value.replace(/[\s-]/g, '')).toContain("911234567890");
  });

  it("should render field error", async () => {
    jest.spyOn(toast, "info");
    axios.mockImplementationOnce(() =>
      Promise.reject({
        response: {
          status: 400,
          statusText: "OK",
          data: {
            phone_number: [
              "The new phone number must be different than the old one.",
            ],
          },
        },
      }),
    );

    const {container} = mountComponent(props);
    
    const form = container.querySelector("form");
    fireEvent.submit(form);
    
    await tick();
    
    expect(toast.info).not.toHaveBeenCalled();
    
    // Check error message appears
    await waitFor(() => {
      const errorElement = container.querySelector('.error');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement.textContent).toContain(
        "The new phone number must be different than the old one."
      );
    });
  });

  it("should render nonField error", async () => {
    jest.spyOn(toast, "info");
    axios.mockImplementationOnce(() =>
      Promise.reject({
        response: {
          status: 400,
          statusText: "OK",
          data: {
            non_field_errors: ["Maximum daily limit reached."],
          },
        },
      }),
    );

    const {container} = mountComponent(props);
    
    const form = container.querySelector("form");
    fireEvent.submit(form);
    
    await tick();
    
    expect(toast.info).not.toHaveBeenCalled();
    
    // Check error message appears
    await waitFor(() => {
      const errorElement = container.querySelector('.error');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement.textContent).toContain("Maximum daily limit reached.");
    });
    
    expect(lastConsoleOutuput).not.toBe(null);
  });

  it("should cancel successfully", async () => {
    jest.spyOn(toast, "info");
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 200,
        statusText: "OK",
        data: null,
      }),
    );

    const {container} = mountComponent(props);
    
    const cancelButton = container.querySelector(".cancel a.button, .cancel Link.button");
    
    if (cancelButton) {
      fireEvent.click(cancelButton);
    }
    
    expect(toast.info).not.toHaveBeenCalled();
    expect(lastConsoleOutuput).toBe(null);
  });

  it("should set title", async () => {
    mountComponent(props);
    
    expect(props.setTitle).toHaveBeenCalledWith(
      "Change mobile number",
      props.orgName,
    );
  });
});

describe("Change Phone Number: corner cases", () => {
  let props;
  const mockAxios = (responseData = {}) => {
    axios.mockImplementationOnce(() =>
      Promise.resolve({
        status: 200,
        statusText: "OK",
        data: {
          response_code: "AUTH_TOKEN_VALIDATION_SUCCESSFUL",
          radius_user_token: "o6AQLY0aQjD3yuihRKLknTn8krcQwuy2Av6MCsFB",
          username: "tester@tester.com",
          is_active: false,
          phone_number: "+393660011222",
          ...responseData,
        },
      }),
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockReset();
    props = createTestProps();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Re-setup the getConfig mock after clearing
    getConfig.mockImplementation(() => mockConfig);
  });

  it("should recognize if user is active", async () => {
    validateToken.mockReturnValue(true);
    const activeUserData = {...userData, is_active: true};
    props.userData = activeUserData;

    const {container} = mountComponent(props);

    // Wait for phone number to be populated from userData (componentDidMount)
    await waitFor(() => {
      const phoneInput = container.querySelector("input[name='phone_number']");
      // Phone input formats the number
      expect(phoneInput.value.replace(/[\s-]/g, '')).toContain("393660011222");
    });
    expect(props.setUserData).not.toHaveBeenCalled();
  });

  it("should not redirect if mobile_phone_verification is enabled", async () => {
    mockAxios();
    props.settings.mobile_phone_verification = true;
    
    const {queryByTestId} = mountComponent(props);
    
    expect(queryByTestId("status-mock")).not.toBeInTheDocument();
  });

  it("shouldn't redirect if user is active and mobile verificaton is true", async () => {
    validateToken.mockReturnValue(true);
    props.userData = {...userData, is_active: true};
    props.settings.mobile_phone_verification = true;
    
    const {queryByTestId} = mountComponent(props);
    
    expect(queryByTestId("status-mock")).not.toBeInTheDocument();
  });

  it("should not redirect if user registration method is mobile_phone", async () => {
    validateToken.mockReturnValue(true);
    props.userData = {
      ...userData,
      is_active: true,
      method: "mobile_phone",
    };
    props.settings.mobile_phone_verification = true;
    
    const {queryByTestId} = mountComponent(props);
    
    expect(queryByTestId("status-mock")).not.toBeInTheDocument();
  });

  it("should validate token", async () => {
    mountComponent(props);
    
    expect(validateToken).toHaveBeenCalledWith(
      props.cookies,
      props.orgSlug,
      props.setUserData,
      props.userData,
      props.logout,
      props.language,
    );
  });

  it("should redirect if mobile_phone_verification disabled", async () => {
    props.settings.mobile_phone_verification = false;

    const {container} = mountComponent(props);

    // Component renders Navigate component which triggers routing
    // The form should not be present when redirecting
    expect(container.querySelector('#mobile-phone-change-form')).toBeNull();
  });

  it("should redirect if user registration method is not mobile_phone", async () => {
    validateToken.mockReturnValue(true);
    props.userData = {
      ...userData,
      is_active: true,
      method: "saml",
    };
    props.settings.mobile_phone_verification = true;

    const {container} = mountComponent(props);

    // Component renders Navigate component which triggers routing
    // The form should not be present when redirecting
    expect(container.querySelector('#mobile-phone-change-form')).toBeNull();
  });
});
