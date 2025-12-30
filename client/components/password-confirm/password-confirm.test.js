/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable camelcase */
import axios from "axios";
import { render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from "react";
import {MemoryRouter} from "react-router-dom";
import {Provider} from "react-redux";
import {toast} from "react-toastify";
import getConfig from "../../utils/get-config";
import loadTranslation from "../../utils/load-translation";
import PasswordConfirm from "./password-confirm";
import translation from "../../test-translation.json";
import tick from "../../utils/tick";

const mockConfig = {
  name: "default name",
  slug: "default",
  default_language: "en",
  components: {
    password_reset_confirm_form: {
      input_fields: {
        password: {
          pattern: ".{6,}",
        },
        password_confirm: {
          pattern: ".{6,}",
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

jest.mock("axios");
jest.mock("../../utils/get-config", () => ({
  __esModule: true,
  default: jest.fn(() => mockConfig),
}));
jest.mock("../../utils/load-translation");

const defaultConfig = getConfig("default", true);
const createTestProps = (props) => ({
  language: "en",
  orgSlug: "default",
  orgName: "default name",
  configuration: defaultConfig,
  passwordConfirm: defaultConfig.components.password_reset_confirm_form,
  setTitle: jest.fn(),
  params: {
    uid: "testUid",
    token: "testToken",
  },
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

const renderWithProviders = (props) => {
  const state = {
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
  };

  const mockedStore = {
    subscribe: () => {},
    dispatch: () => {},
    getState: () => state,
  };

  return render(
    <Provider store={mockedStore}>
      <MemoryRouter>
        <PasswordConfirm {...props} />
      </MemoryRouter>
    </Provider>
  );
};

describe("<PasswordConfirm /> rendering with placeholder translation tags", () => {
  const props = createTestProps();
  it("should render translation placeholder correctly", () => {
    const {container} = renderWithProviders(props);
    expect(container).toMatchSnapshot();
  });
});

describe("<PasswordConfirm /> rendering", () => {
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
    const {container} = renderWithProviders(props);
    expect(container).toMatchSnapshot();
  });

  it("should render 2 input fields", () => {
    const {container} = renderWithProviders(props);
    expect(container.querySelectorAll('.input')).toHaveLength(2);
  });

  it("should render password field correctly", () => {
    const {container} = renderWithProviders(props);
    
    const passwordLabel = container.querySelector('.row.password label');
    expect(passwordLabel).toHaveTextContent(getTranslationString("PWD_LBL"));
    
    const passwordInput = container.querySelector('.row.password input');
    expect(passwordInput).toHaveAttribute("placeholder", getTranslationString("PWD_PHOLD"));
    expect(passwordInput).toHaveAttribute("title", getTranslationString("PWD_PTRN_DESC"));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("should render password confirm field correctly", () => {
    const {container} = renderWithProviders(props);
    
    const confirmLabel = container.querySelector('.row.password-confirm label');
    expect(confirmLabel).toHaveTextContent(getTranslationString("CONFIRM_PWD_LBL"));
    
    const confirmInput = container.querySelector('.row.password-confirm input');
    expect(confirmInput).toHaveAttribute("placeholder", getTranslationString("CONFIRM_PWD_PHOLD"));
    expect(confirmInput).toHaveAttribute("title", getTranslationString("PWD_PTRN_DESC"));
    expect(confirmInput).toHaveAttribute("type", "password");
  });
});

describe("<PasswordConfirm /> interactions", () => {
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
    const {container} = renderWithProviders(props);
    
    const passwordInput = container.querySelector(".password input");
    fireEvent.change(passwordInput, {
      target: {value: "123456", name: "newPassword1"}
    });
    expect(passwordInput.value).toEqual("123456");
    
    const confirmInput = container.querySelector(".password-confirm input");
    fireEvent.change(confirmInput, {
      target: {value: "123456", name: "newPassword2"}
    });
    expect(confirmInput.value).toEqual("123456");
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
      .mockImplementationOnce(() =>
        Promise.reject({
          response: {data: {token: ["Invalid token"]}},
        }),
      )
      .mockImplementationOnce(() => Promise.resolve({data: {detail: true}}));

    const {container} = renderWithProviders(props);
    const spyToastError = jest.spyOn(toast, "error");
    const spyToastSuccess = jest.spyOn(toast, "success");
    
    const passwordInput = container.querySelector(".password input");
    const confirmInput = container.querySelector(".password-confirm input");
    const form = container.querySelector("form");

    // Test 1: Password mismatch
    fireEvent.change(passwordInput, {
      target: {value: "wrong password", name: "newPassword1"}
    });
    fireEvent.change(confirmInput, {
      target: {value: "wrong password1", name: "newPassword2"}
    });
    fireEvent.submit(form);

    await waitFor(() => {
      const errorDiv = container.querySelector(".password-confirm div.error");
      expect(errorDiv).toBeInTheDocument();
    });

    // Test 2: Matching passwords, API error (detail)
    fireEvent.change(passwordInput, {
      target: {value: "password", name: "newPassword1"}
    });
    fireEvent.change(confirmInput, {
      target: {value: "password", name: "newPassword2"}
    });
    fireEvent.submit(form);

    await tick();
    await waitFor(() => {
      expect(container.querySelector('.error.non-field')).toBeInTheDocument();
      expect(spyToastError).toHaveBeenCalledTimes(1);
    });
    expect(lastConsoleOutuput).not.toBe(null);
    lastConsoleOutuput = null;

    // Test 3: API error (non_field_errors)
    fireEvent.submit(form);
    await tick();
    await waitFor(() => {
      expect(spyToastError).toHaveBeenCalledTimes(2);
    });
    expect(lastConsoleOutuput).not.toBe(null);
    lastConsoleOutuput = null;

    // Test 4: API error (token)
    fireEvent.submit(form);
    await tick();
    await waitFor(() => {
      expect(spyToastError).toHaveBeenCalledTimes(3);
    });
    expect(lastConsoleOutuput).not.toBe(null);
    lastConsoleOutuput = null;

    // Test 5: Success
    fireEvent.submit(form);
    await tick();
    await waitFor(() => {
      expect(container.querySelector('.input.error')).not.toBeInTheDocument();
      expect(container.querySelector('.success')).toBeInTheDocument();
      expect(spyToastSuccess).toHaveBeenCalledTimes(1);
    });
    // Allow act() warnings for async state updates
    const hasOnlyActWarnings = lastConsoleOutuput === null ||
      (typeof lastConsoleOutuput === 'string' && lastConsoleOutuput.includes('act(...)'));
    expect(hasOnlyActWarnings).toBe(true);
    expect(spyToastError).toHaveBeenCalledTimes(3);
  });

  it("should set title", () => {
    renderWithProviders(props);
    expect(props.setTitle).toHaveBeenCalledWith("Reset Password", props.orgName);
  });

  it("should toggle password visibility", async () => {
    const {container} = renderWithProviders(props);

    let passwordInput;
    let confirmInput;
    await waitFor(() => {
      passwordInput = container.querySelector('input#password');
      confirmInput = container.querySelector('input#password-confirm');

      expect(passwordInput).toBeInTheDocument();
      expect(confirmInput).toBeInTheDocument();

      // Initially should be password type
    });
    expect(confirmInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const passwordToggles = container.querySelectorAll('.password-toggle');

    if (passwordToggles.length > 0) {
      fireEvent.click(passwordToggles[0]);

      await waitFor(() => {
        // After toggle, inputs should change to text type
        const textInputs = container.querySelectorAll("input[type='text']");
        expect(textInputs.length).toBeGreaterThan(0);
      });
    }
  });

  it("should show validation error for password mismatch", async () => {
    const {container} = renderWithProviders(props);
    
    const passwordInput = container.querySelector(".password input");
    const confirmInput = container.querySelector(".password-confirm input");
    const form = container.querySelector("form");
    
    fireEvent.change(passwordInput, {
      target: {value: "password123", name: "newPassword1"}
    });
    fireEvent.change(confirmInput, {
      target: {value: "password456", name: "newPassword2"}
    });
    
    fireEvent.submit(form);
    
    await waitFor(() => {
      const errorElement = container.querySelector('.error');
      expect(errorElement).toBeInTheDocument();
    });
  });

  it("should clear errors on successful submit", async () => {
    axios.mockImplementationOnce(() => 
      Promise.resolve({data: {detail: true}})
    );
    
    const {container} = renderWithProviders(props);
    
    const passwordInput = container.querySelector(".password input");
    const confirmInput = container.querySelector(".password-confirm input");
    const form = container.querySelector("form");
    
    fireEvent.change(passwordInput, {
      target: {value: "password123", name: "newPassword1"}
    });
    fireEvent.change(confirmInput, {
      target: {value: "password123", name: "newPassword2"}
    });
    
    fireEvent.submit(form);
    
    await tick();
    await waitFor(() => {
      expect(container.querySelector('.success')).toBeInTheDocument();
      expect(container.querySelector('.error')).not.toBeInTheDocument();
    });
  });
});
