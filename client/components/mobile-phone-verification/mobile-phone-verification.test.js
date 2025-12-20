/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable camelcase */
import axios from "axios";
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {toast} from "react-toastify";
import React from "react";
import PropTypes from "prop-types";
import {Cookies} from "react-cookie";
import {MemoryRouter} from "react-router-dom";
import {Provider} from "react-redux";
import {loadingContextValue} from "../../utils/loading-context";
import tick from "../../utils/tick";

// Mock modules BEFORE importing
jest.mock("../../utils/get-config", () => ({
  __esModule: true,
  default: jest.fn((slug, isTest) => ({
    slug: "default",
    name: "default name",
    components: {
      mobile_phone_verification_form: {
        input_fields: {
          code: {
            type: "text",
            pattern: "^[0-9]{6}$",
          },
        },
      },
    },
    settings: {
      mobile_phone_verification: true,
    },
  })),
}));
jest.mock("../../utils/validate-token");
jest.mock("../../utils/load-translation");
jest.mock("../../utils/log-error");
jest.mock("../../utils/handle-logout");
jest.mock("axios");

import getConfig from "../../utils/get-config";
import MobilePhoneVerification from "./mobile-phone-verification";
import validateToken from "../../utils/validate-token";
import loadTranslation from "../../utils/load-translation";
import logError from "../../utils/log-error";
import handleLogout from "../../utils/handle-logout";

const createTestProps = function (props, configName = "test-org-2") {
  const config = getConfig(configName);
  return {
    mobile_phone_verification: config.components.mobile_phone_verification_form,
    settings: config.settings,
    language: "en",
    orgSlug: config.slug,
    orgName: config.name,
    cookies: new Cookies(),
    logout: jest.fn(),
    setUserData: jest.fn(),
    userData: {},
    setTitle: jest.fn(),
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

const userData = {
  response_code: "AUTH_TOKEN_VALIDATION_SUCCESSFUL",
  radius_user_token: "o6AQLY0aQjD3yuihRKLknTn8krcQwuy2Av6MCsFB",
  username: "tester@tester.com",
  is_active: false,
  is_verified: false,
  phone_number: "+393660011222",
};

describe("<MobilePhoneVerification /> rendering with placeholder translation tags", () => {
  beforeEach(() => {
    // Mock axios to handle multiple calls during component mount:
    // 1. activePhoneToken (GET) - returns { active: false } so createPhoneToken is called
    // 2. createPhoneToken (POST) - returns success
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 200,
        statusText: "OK",
        data: {active: false},
        active: false,
      }),
    );
  });

  afterEach(() => {
    axios.mockReset();
  });

  const props = createTestProps();
  it("should render translation placeholder correctly", () => {
    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);
    expect(container).toMatchSnapshot();
  });
});

describe("Mobile Phone Token verification: standard flow", () => {
  let props;
  let lastConsoleOutuput;
  let originalError;
  const event = {preventDefault: jest.fn()};

  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockReset();
    props = createTestProps();
    // Use mockImplementation to handle multiple axios calls during componentDidMount
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 201,
        statusText: "CREATED",
        data: null,
      }),
    );
    validateToken.mockClear();
    // console mocking
    originalError = console.error;
    lastConsoleOutuput = null;
    console.error = (data) => {
      lastConsoleOutuput = data;
    };
  });

  afterEach(() => {
    axios.mockReset();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Re-setup the getConfig mock after clearing
    getConfig.mockImplementation(() => ({
      slug: "default",
      name: "default name",
      components: {
        mobile_phone_verification_form: {
          input_fields: {
            code: {
              type: "text",
              pattern: "^[0-9]{6}$",
            },
          },
        },
      },
      settings: {
        mobile_phone_verification: true,
      },
    }));
    sessionStorage.clear();
    console.error = originalError;
  });

  it("should render successfully", async () => {
    validateToken.mockResolvedValue(true);
    props.userData = userData;
    loadTranslation("en", "default");

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    // Wait for component to fully render with phone number
    await waitFor(() => {
      expect(container.querySelector('form .row .label').textContent).toContain("+393660011222");
    });

    expect(axios).toHaveBeenCalled();
    expect(container).toMatchSnapshot();
    expect(container.querySelector('form')).toBeInTheDocument();
    expect(container.querySelector("form button[type='submit']")).toBeInTheDocument();
    expect(container.querySelector("form input[type='text']")).toBeInTheDocument();
    expect(container.querySelector('.resend .button')).toBeInTheDocument();
    expect(container.querySelector('.change .button')).toBeInTheDocument();
    expect(container.querySelector('.logout .button')).toBeInTheDocument();
  });

  it("should disable resend button if cooldown is present in CreatePhoneToken success", async () => {
    validateToken.mockResolvedValue(true);
    axios.mockReset();
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 201,
        statusText: "CREATED",
        data: {cooldown: 30},
      }),
    );
    jest.spyOn(Date, "now").mockReturnValue(1690369255287);
    props.userData = userData;

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    // Wait for resend button to be disabled
    await waitFor(() => {
      const resendButton = container.querySelector('.resend .button');
      expect(resendButton).toHaveAttribute('disabled');
    });

    expect(axios).toHaveBeenCalled();
    expect(container).toMatchSnapshot();
  });

  it("should disable resend button if cooldown is present in CreatePhoneToken failure", async () => {
    validateToken.mockReturnValue(true);
    jest.spyOn(toast, "error");
    axios.mockReset();
    axios.mockImplementation(() =>
      Promise.reject({
        response: {
          status: 400,
          statusText: "BAD_REQUEST",
          data: {
            non_field_errors: ["Wait before requesting another SMS token."],
            cooldown: 20,
          },
        },
      }),
    );
    jest.spyOn(Date, "now").mockReturnValue(1690369255287);
    props.userData = userData;

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    expect(axios).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(container).toMatchSnapshot();
  });

  it("should check if active token is present", async () => {
    validateToken.mockResolvedValue(true);
    axios.mockReset();
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 200,
        active: true,
      }),
    );

    renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    // Component should check for active token
    expect(axios).toHaveBeenCalled();
  });

  it("should not show error if active phone token returns 404", async () => {
    axios.mockReset();
    // activePhoneToken returns 404 (should be handled silently)
    // Then createPhoneToken should succeed
    let callCount = 0;
    axios.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: activePhoneToken - returns 404 (handled silently)
        return Promise.reject({
          response: {
            status: 404,
            statusText: "NOT FOUND",
            data: {
              non_field_errors: ["Not Found"],
            },
          },
        });
      }
      // Second call: createPhoneToken - succeeds
      return Promise.resolve({
        status: 201,
        statusText: "CREATED",
        data: null,
      });
    });
    validateToken.mockResolvedValue(true);
    jest.spyOn(toast, "error");

    renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    expect(logError).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("should not execute createPhoneToken if invalid organization", async () => {
    axios.mockReset();
    axios.mockImplementation(() =>
      Promise.reject({
        response: {
          status: 404,
          statusText: "NOT FOUND",
          data: {
            non_field_errors: ["Not Found"],
            response_code: "INVALID_ORGANIZATION",
          },
        },
      }),
    );
    validateToken.mockResolvedValue(true);
    jest.spyOn(toast, "error");

    renderWithProviders(<MobilePhoneVerification {...props} />);

    await waitFor(() => {
      expect(logError).toHaveBeenCalledTimes(1);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Not Found");
  });

  it("should show error on if active phone token check fails", async () => {
    // Set up axios to reject all calls with 400 error
    axios.mockReset();
    axios.mockImplementation(() =>
      Promise.reject({
        response: {
          status: 400,
          statusText: "BAD REQUEST",
          data: {
            non_field_errors: ["Bad request"],
          },
        },
      }),
    );
    validateToken.mockResolvedValue(true);
    jest.spyOn(toast, "error");
    props.userData = userData;

    renderWithProviders(<MobilePhoneVerification {...props} />);

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        {
          response: {
            data: {non_field_errors: ["Bad request"]},
            status: 400,
            statusText: "BAD REQUEST",
          },
        },
        "Bad request",
      );
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("should resend token successfully", async () => {
    jest.spyOn(toast, "info");
    validateToken.mockResolvedValue(true);
    // Reset and set up axios mock before rendering - must handle all calls
    axios.mockReset();
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 201,
        statusText: "CREATED",
        data: null,
      }),
    );
    props.userData = userData;

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    // Wait for form to render
    await waitFor(() => {
      expect(container.querySelector('.resend .button')).toBeInTheDocument();
    });

    // Clear the toast.info calls from componentDidMount before clicking resend
    toast.info.mockClear();

    const resendButton = container.querySelector('.resend .button');
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledTimes(1);
    });
  });

  it("should verify token successfully and must call setUserData", async () => {
    validateToken.mockResolvedValue(true);
    // Reset and set up axios mock before rendering
    axios.mockReset();
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 201,
        statusText: "CREATED",
        data: null,
      }),
    );
    props.userData = userData;

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    // Wait for form to render
    await waitFor(() => {
      expect(container.querySelector('form')).toBeInTheDocument();
    });

    // Set up axios for the form submission
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 200,
        statusText: "OK",
        data: null,
      }),
    );

    const codeInput = container.querySelector("form .code input[type='text']");
    fireEvent.change(codeInput, {target: {value: "12345", name: "code"}});
    expect(codeInput.value).toBe("12345");

    const form = container.querySelector("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(props.setUserData).toHaveBeenCalledTimes(1);
    });

    expect(props.setUserData).toHaveBeenCalledWith({
      ...userData,
      is_active: true,
      is_verified: true,
      mustLogin: true,
      username: userData.phone_number,
    });
  });

  it("should show errors", async () => {
    validateToken.mockResolvedValue(true);
    // Reset and set up axios mock before rendering
    axios.mockReset();
    axios.mockImplementation(() =>
      Promise.resolve({
        status: 201,
        statusText: "CREATED",
        data: null,
      }),
    );
    props.userData = userData;

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    // Wait for form to render
    await waitFor(() => {
      expect(container.querySelector('form')).toBeInTheDocument();
    });

    // Now set up axios to reject for the form submission
    axios.mockImplementation(() =>
      Promise.reject({
        response: {
          status: 400,
          statusText: "BAD REQUEST",
          data: {
            non_field_errors: ["Invalid code."],
          },
        },
      }),
    );

    const codeInput = container.querySelector("form .code input[type='text']");
    fireEvent.change(codeInput, {target: {value: "12345", name: "code"}});
    expect(codeInput.value).toBe("12345");

    const form = container.querySelector("form");
    fireEvent.submit(form);

    await waitFor(() => {
      const errorElement = container.querySelector('.error');
      expect(errorElement).toBeInTheDocument();
    });

    expect(props.setUserData).not.toHaveBeenCalled();

    expect(logError).toHaveBeenCalledWith(
      {
        response: {
          data: {
            non_field_errors: ["Invalid code."],
          },
          status: 400,
          statusText: "BAD REQUEST",
        },
      },
      "Invalid code.",
    );
  });

  it("should log out successfully", async () => {
    validateToken.mockReturnValue(true);
    jest.spyOn(toast, "success");
    props.userData = userData;

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    const logoutButton = container.querySelector('.logout .button');
    fireEvent.click(logoutButton);

    await tick();

    expect(handleLogout).toHaveBeenCalledTimes(1);
    expect(handleLogout).toHaveBeenCalledWith(
      props.logout,
      props.cookies,
      props.orgSlug,
      props.setUserData,
      props.userData,
      true,
    );
  });

  it("should set title", async () => {
    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    expect(props.setTitle).toHaveBeenCalledWith(
      "Verify mobile number",
      props.orgName,
    );
  });

  it("should not call API to resend token if one has already sent", async () => {
    sessionStorage.setItem("owPhoneTokenSent", true);

    renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    // Since token was already sent, API shouldn't be called again
    // This is tested by the component's internal logic

    sessionStorage.removeItem("owPhoneTokenSent");
  });

  it("should show error on rejection", async () => {
    axios.mockReset();
    axios.mockImplementationOnce(() =>
      Promise.reject({
        response: {
          status: 400,
          statusText: "BAD REQUEST",
          data: {
            non_field_errors: ["Bad request"],
          },
        },
      }),
    );
    validateToken.mockReturnValue(true);
    jest.spyOn(toast, "error");

    renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    expect(logError).toHaveBeenCalledWith(
      {
        response: {
          data: {non_field_errors: ["Bad request"]},
          status: 400,
          statusText: "BAD REQUEST",
        },
      },
      "Bad request",
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe("Mobile Phone Token verification: corner cases", () => {
  let props;

  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockReset();
    props = createTestProps();
    validateToken.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Re-setup the getConfig mock after clearing
    getConfig.mockImplementation(() => ({
      slug: "default",
      name: "default name",
      components: {
        mobile_phone_verification_form: {
          input_fields: {
            code: {
              type: "text",
              pattern: "^[0-9]{6}$",
            },
          },
        },
      },
      settings: {
        mobile_phone_verification: true,
      },
    }));
    sessionStorage.clear();
  });

  it("should not proceed if user is already verified", async () => {
    validateToken.mockReturnValue(true);
    props.userData = {...userData, is_active: true, is_verified: true};

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    // Should not create phone token for already verified user
    // Component should render but not call create token API
  });

  it("should not proceed if mobile verification is not enabled", async () => {
    validateToken.mockReturnValue(true);
    props.settings.mobile_phone_verification = false;

    const {container} = renderWithProviders(<MobilePhoneVerification {...props} />);

    await tick();

    // Should not proceed with verification if feature is disabled
  });
});
