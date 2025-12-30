/* eslint-disable prefer-promise-reject-errors */
import axios from "axios";
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from "react";
import {toast} from "react-toastify";
import {MemoryRouter} from "react-router-dom";
import {Provider} from "react-redux";

import getConfig from "../../utils/get-config";
import loadTranslation from "../../utils/load-translation";
import PasswordReset from "./password-reset";
import translation from "../../test-translation.json";
import tick from "../../utils/tick";

// Mock modules BEFORE importing
jest.mock("axios");
jest.mock("../../utils/get-config", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    components: {
      password_reset_form: {
        input_fields: {
          email: {},
        },
      },
    },
  })),
}));
jest.mock("../../utils/load-translation");

const defaultConfig = getConfig("default", true);
const createTestProps = (props) => ({
  orgSlug: "default",
  orgName: "default name",
  setTitle: jest.fn(),
  passwordReset: defaultConfig.components.password_reset_form,
  language: "en",
  ...props,
});

const getTranslationString = (msgid) => {
  try {
    return translation.translations[""][msgid].msgstr[0];
  } catch (err) {
    console.error(err, msgid);
    return msgid;
  }
};

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

describe("<PasswordReset /> rendering with placeholder translation tags", () => {
  const props = createTestProps();
  it("should render translation placeholder correctly", () => {
    const {container} = renderWithProviders(<PasswordReset {...props} />);
    expect(container).toMatchSnapshot();
  });
});

describe("<PasswordReset /> rendering", () => {
  let props;

  beforeEach(() => {
    jest.clearAllMocks();
    props = createTestProps();
    loadTranslation("en", "default");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render correctly", () => {
    const {container} = renderWithProviders(<PasswordReset {...props} />);
    expect(container).toMatchSnapshot();
  });

  it("should render 2 inputs", () => {
    const {container} = renderWithProviders(<PasswordReset {...props} />);
    
    expect(container.querySelectorAll("input")).toHaveLength(2);
    expect(container.querySelectorAll("input[type='text']")).toHaveLength(1);
    expect(container.querySelectorAll("input[type='submit']")).toHaveLength(1);
  });

  it("should render input field correctly", () => {
    const {container} = renderWithProviders(<PasswordReset {...props} />);
    
    const emailInput = container.querySelector("input[type='text']");
    const label = container.querySelector('.row label');
    
    expect(label).toHaveTextContent(getTranslationString("USERNAME_LOG_LBL"));
    expect(emailInput).toHaveAttribute("placeholder", getTranslationString("USERNAME_LOG_PHOLD"));
    expect(emailInput).toHaveAttribute("title", getTranslationString("USERNAME_LOG_TITL"));
    expect(emailInput).toHaveAttribute("type", "text");
  });
});

describe("<PasswordReset /> interactions", () => {
  let props;
  let originalError;
  let lastConsoleOutuput;

  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockReset();
    originalError = console.error;
    lastConsoleOutuput = null;
    console.error = (data) => {
      lastConsoleOutuput = data;
    };
    props = createTestProps();
  });

  afterEach(() => {
    console.error = originalError;
    jest.clearAllMocks();
  });

  it("should change state values when handleChange function is invoked", () => {
    const {container} = renderWithProviders(<PasswordReset {...props} />);
    
    const emailInput = container.querySelector("input[type='text']");
    fireEvent.change(emailInput, {
      target: {value: "test@test.com", name: "input"}
    });
    
    expect(emailInput.value).toEqual("test@test.com");
  });

  it("should execute handleSubmit correctly when form is submitted", async () => {
    axios
      .mockImplementationOnce(() =>
        Promise.reject({response: {data: {detail: "errors"}}}),
      )
      .mockImplementationOnce(() =>
        Promise.reject({
          response: {data: {non_field_errors: ["non field errors"]}},
        }),
      )
      .mockImplementationOnce(() => Promise.resolve({data: {detail: true}}));
    
    const {container} = renderWithProviders(<PasswordReset {...props} />);
    
    const spyToastError = jest.spyOn(toast, "error");
    const spyToastSuccess = jest.spyOn(toast, "success");
    const form = container.querySelector("form");
    
    // Test 1: Error with detail
    fireEvent.submit(form);
    await tick();
    
    await waitFor(() => {
      expect(container.querySelector("div.error")).toBeInTheDocument();
      expect(container.querySelector("input.error")).toBeInTheDocument();
      expect(spyToastError).toHaveBeenCalledTimes(1);
    });
    expect(lastConsoleOutuput).not.toBe(null);
    expect(spyToastSuccess).toHaveBeenCalledTimes(0);
    lastConsoleOutuput = null;
    
    // Test 2: Error with non_field_errors
    fireEvent.submit(form);
    await tick();
    
    await waitFor(() => {
      expect(spyToastError).toHaveBeenCalledTimes(2);
    });
    expect(lastConsoleOutuput).not.toBe(null);
    expect(spyToastSuccess).toHaveBeenCalledTimes(0);
    lastConsoleOutuput = null;
    
    // Test 3: Success
    fireEvent.submit(form);
    await tick();
    
    await waitFor(() => {
      expect(container.querySelector('.error')).not.toBeInTheDocument();
      expect(container.querySelector('.success')).toBeInTheDocument();
      expect(spyToastSuccess).toHaveBeenCalledTimes(1);
    });
    // Allow act() warnings for async state updates
    const hasOnlyActWarnings = lastConsoleOutuput === null ||
      (typeof lastConsoleOutuput === 'string' && lastConsoleOutuput.includes('act(...)'));
    expect(hasOnlyActWarnings).toBe(true);
    expect(spyToastError).toHaveBeenCalledTimes(2);
  });

  it("should set title", () => {
    renderWithProviders(<PasswordReset {...props} />);
    
    expect(props.setTitle).toHaveBeenCalledWith("Reset Password", props.orgName);
  });

  it("should clear errors on successful password reset", async () => {
    axios.mockImplementationOnce(() => 
      Promise.resolve({data: {detail: true}})
    );
    
    const {container} = renderWithProviders(<PasswordReset {...props} />);
    
    const emailInput = container.querySelector("input[type='text']");
    const form = container.querySelector("form");
    
    fireEvent.change(emailInput, {
      target: {value: "test@test.com", name: "input"}
    });
    
    fireEvent.submit(form);
    await tick();
    
    await waitFor(() => {
      expect(container.querySelector('.success')).toBeInTheDocument();
      expect(container.querySelector('.error')).not.toBeInTheDocument();
    });
  });

  it("should show error message for invalid email", async () => {
    axios.mockImplementationOnce(() =>
      Promise.reject({response: {data: {detail: "Invalid email"}}})
    );
    
    const {container} = renderWithProviders(<PasswordReset {...props} />);
    
    const emailInput = container.querySelector("input[type='text']");
    const form = container.querySelector("form");
    
    fireEvent.change(emailInput, {
      target: {value: "invalid-email", name: "input"}
    });
    
    fireEvent.submit(form);
    await tick();
    
    await waitFor(() => {
      expect(container.querySelector('.error')).toBeInTheDocument();
    });
  });
});
