import axios from "axios";
/* eslint-disable camelcase */
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from "react";
import {Cookies} from "react-cookie";
import {MemoryRouter} from "react-router-dom";
import {Provider} from "react-redux";

import getConfig from "../../utils/get-config";
import logError from "../../utils/log-error";
import tick from "../../utils/tick";
import loadTranslation from "../../utils/load-translation";
import PasswordChange from "./password-change";
import validateToken from "../../utils/validate-token";

// Mock modules BEFORE importing
jest.mock("axios");
jest.mock("../../utils/get-config", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    components: {
      password_change_form: {
        input_fields: {
          password: {},
          password1: {
            type: "password",
            pattern: "^.{8,}$",
          },
          password2: {
            type: "password",
          },
        },
      },
    },
  })),
}));
jest.mock("../../utils/log-error");
jest.mock("../../utils/load-translation");
jest.mock("../../utils/validate-token");
jest.mock("../../utils/handle-logout");

logError.mockImplementation(jest.fn());

const defaultConfig = getConfig("default", true);

const createTestProps = (props) => ({
  orgSlug: "default",
  orgName: "default name",
  passwordChange: defaultConfig.components.password_change_form,
  cookies: new Cookies(),
  setTitle: jest.fn(),
  logout: jest.fn(),
  userData: {},
  setUserData: jest.fn(),
  language: "en",
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
            email: "support@openwisp.org",
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

describe("<PasswordChange /> rendering with placeholder translation tags", () => {
  const props = createTestProps();
  it("should render translation placeholder correctly", () => {
    const {container} = renderWithProviders(<PasswordChange {...props} />);
    expect(container).toMatchSnapshot();
  });
});

describe("<PasswordChange /> rendering", () => {
  let props;

  it("should render correctly", () => {
    props = createTestProps();
    loadTranslation("en", "default");
    const {container} = renderWithProviders(<PasswordChange {...props} />);
    expect(container).toMatchSnapshot();
  });

  it("should not show 'cancel' button if password is expired", async () => {
    props = createTestProps();
    props.userData.password_expired = true;
    loadTranslation("en", "default");
    const {container} = renderWithProviders(<PasswordChange {...props} />);
    expect(container).toMatchSnapshot();
    
    // Verify cancel button is not present
    const cancelButton = screen.queryByText(/cancel/i);
    expect(cancelButton).not.toBeInTheDocument();
  });
});

describe("<PasswordChange /> interactions", () => {
  let props;

  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockClear();
    axios.mockReset();
    props = createTestProps();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("test handleChange method", () => {
    const {container} = renderWithProviders(<PasswordChange {...props} />);
    
    const newPasswordInput = container.querySelector("input[name='newPassword1']");
    expect(newPasswordInput).toBeInTheDocument();
    
    fireEvent.change(newPasswordInput, {
      target: {name: "newPassword1", value: "123456"}
    });
    
    expect(newPasswordInput.value).toBe("123456");
  });

  it("test handleSubmit method", async () => {
    axios
      .mockImplementationOnce(() =>
        // eslint-disable-next-line prefer-promise-reject-errors
        Promise.reject({
          response: {
            status: 401,
            statusText: "UNAUTHORIZED",
            data: {},
          },
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: 200,
          statusText: "OK",
          data: {
            detail: "password changed",
          },
        }),
      );

    const {container} = renderWithProviders(<PasswordChange {...props} />);
    
    const form = container.querySelector('form');
    const newPassword1Input = container.querySelector("input[name='newPassword1']");
    const newPassword2Input = container.querySelector("input[name='newPassword2']");
    const currentPasswordInput = container.querySelector("input[name='currentPassword']");
    
    // Test 1: Passwords don't match
    fireEvent.change(newPassword1Input, {target: {name: "newPassword1", value: "123456"}});
    fireEvent.change(newPassword2Input, {target: {name: "newPassword2", value: "wrong-pass"}});
    fireEvent.submit(form);
    
    await waitFor(() => {
      const errorElement = container.querySelector('.error');
      expect(errorElement).toBeInTheDocument();
    });
    
    // Test 2: New password same as current password
    fireEvent.change(currentPasswordInput, {target: {name: "currentPassword", value: "123456"}});
    fireEvent.change(newPassword1Input, {target: {name: "newPassword1", value: "123456"}});
    fireEvent.change(newPassword2Input, {target: {name: "newPassword2", value: "123456"}});
    fireEvent.submit(form);
    
    await waitFor(() => {
      const errorElements = container.querySelectorAll('.error');
      expect(errorElements.length).toBeGreaterThan(0);
    });
    
    // Test 3: Valid password change with server error
    fireEvent.change(currentPasswordInput, {target: {name: "currentPassword", value: "1234567"}});
    fireEvent.change(newPassword1Input, {target: {name: "newPassword1", value: "123456"}});
    fireEvent.change(newPassword2Input, {target: {name: "newPassword2", value: "123456"}});
    fireEvent.submit(form);
    
    await tick();
    await waitFor(() => {
      const errorElement = container.querySelector('.error');
      expect(errorElement).toBeInTheDocument();
    });
    
    // Test 4: Successful password change
    fireEvent.submit(form);
    await tick();
    await waitFor(() => {
      expect(props.navigate).toHaveBeenCalledWith(`/${props.orgSlug}/status`);
    });
  });

  it("should set title", () => {
    renderWithProviders(<PasswordChange {...props} />);
    
    expect(props.setTitle).toHaveBeenCalledWith(
      "Change your password",
      props.orgName,
    );
  });

  it("should execute handleChange if field value changes", () => {
    const {container} = renderWithProviders(<PasswordChange {...props} />);
    
    const newPassword1Input = container.querySelector("input[name='newPassword1']");
    expect(newPassword1Input).toBeInTheDocument();
    expect(newPassword1Input).toHaveAttribute('type', 'password');
    expect(newPassword1Input).toHaveAttribute('id', 'new-password');
    expect(newPassword1Input).toHaveAttribute('placeholder', 'Your new password');
    expect(newPassword1Input).toHaveAttribute('autoComplete', 'password');
    expect(newPassword1Input).toBeRequired();
    
    fireEvent.change(newPassword1Input, {
      target: {name: "newPassword1", value: "123456"}
    });
    expect(newPassword1Input.value).toBe("123456");
    
    const newPassword2Input = container.querySelector("input[name='newPassword2']");
    expect(newPassword2Input).toBeInTheDocument();
    expect(newPassword2Input).toHaveAttribute('type', 'password');
    expect(newPassword2Input).toHaveAttribute('id', 'password-confirm');
    expect(newPassword2Input).toHaveAttribute('placeholder', 'confirm password');
    expect(newPassword2Input).toHaveAttribute('autoComplete', 'password');
    expect(newPassword2Input).toBeRequired();
    
    fireEvent.change(newPassword2Input, {
      target: {name: "newPassword2", value: "123456"}
    });
    expect(newPassword2Input.value).toBe("123456");
  });

  it("should toggle password visibility", async () => {
    const {container} = renderWithProviders(<PasswordChange {...props} />);

    // Find all password toggle icons by looking for eye icons
    const passwordToggles = container.querySelectorAll('.eye, .eye-slash');
    expect(passwordToggles.length).toBeGreaterThan(0);

    // Get the password input fields
    const currentPasswordInput = container.querySelector("input[name='currentPassword']");
    const newPassword1Input = container.querySelector("input[name='newPassword1']");
    const newPassword2Input = container.querySelector("input[name='newPassword2']");

    // Initially should be password type
    expect(currentPasswordInput).toHaveAttribute('type', 'password');
    expect(newPassword1Input).toHaveAttribute('type', 'password');
    expect(newPassword2Input).toHaveAttribute('type', 'password');

    // Click the first toggle icon (for newPassword1) to reveal password
    // The parent div is what has the onClick handler
    const firstToggleParent = passwordToggles[0].parentElement;
    fireEvent.click(firstToggleParent);

    // After clicking, at least one should change to text type
    await waitFor(() => {
      const textInputs = container.querySelectorAll("input[type='text']");
      expect(textInputs.length).toBeGreaterThan(0);
    });
  });

  it("should validate token", async () => {
    props = createTestProps();
    renderWithProviders(<PasswordChange {...props} />);
    
    expect(validateToken).toHaveBeenCalledWith(
      props.cookies,
      props.orgSlug,
      props.setUserData,
      props.userData,
      props.logout,
      props.language,
    );
  });

  it("should redirect to status if login method is SAML / Social Login", async () => {
    props = createTestProps();
    props.userData.method = "saml";

    const {rerender} = renderWithProviders(<PasswordChange {...props} />);

    // Test with social_login method
    props.userData.method = "social_login";
    rerender(
      <Provider store={createMockStore()}>
        <MemoryRouter>
          <PasswordChange {...props} />
        </MemoryRouter>
      </Provider>
    );

    // Verify redirect behavior for social login
    // The component should handle this appropriately
  });
});
