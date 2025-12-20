import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from "react";
import {BrowserRouter as Router, MemoryRouter} from "react-router-dom";

// Mock modules BEFORE importing
jest.mock("../../utils/get-config", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    components: {
      header: {
        logo: {
          url: "/assets/default/openwisp-logo-black.svg",
          alternate_text: "openwisp",
        },
        links: [],
      },
    },
  })),
}));
jest.mock("../../utils/load-translation");
jest.mock("../../utils/check-internal-links");

import getConfig from "../../utils/get-config";
import loadTranslation from "../../utils/load-translation";
import isInternalLink from "../../utils/check-internal-links";
import Header from "./header";
import {mapDispatchToProps} from "./index";

const defaultConfig = getConfig("default", true);
const headerLinks = [
  {
    text: {en: "link-1"},
    url: "link-1/",
  },
  {
    text: {en: "link-2"},
    url: "link-2/",
    authenticated: false,
  },
  {
    text: {en: "link-3"},
    url: "link-3/",
    authenticated: true,
  },
  {
    text: {en: "link-4"},
    url: "link-4/",
    authenticated: true,
    verified: true,
  },
];

const getLinkText = (container, selector) => {
  const elements = container.querySelectorAll(selector);
  return Array.from(elements).map(el => el.textContent);
};

const createTestProps = (props) => ({
  setLanguage: jest.fn(),
  orgSlug: "default",
  language: "en",
  languages: [
    {slug: "en", text: "english"},
    {slug: "it", text: "italian"},
  ],
  header: defaultConfig.components.header,
  location: {
    pathname: "/default/login",
  },
  userData: {is_verified: true},
  ...props,
});

describe("<Header /> rendering with placeholder translation tags", () => {
  const props = createTestProps();
  it("should render translation placeholder correctly", () => {
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });
});

describe("<Header /> rendering", () => {
  let props;
  
  beforeEach(() => {
    jest.resetAllMocks();
    props = createTestProps();
    loadTranslation("en", "default");
  });

  it("should render without links", () => {
    const links = {
      header: {
        ...props.header,
        links: [],
      },
    };
    props = createTestProps(links);
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it("should call isInternalLink and render if the link is internal", () => {
    isInternalLink.mockReturnValue(true);
    props = createTestProps();
    props.isAuthenticated = true;
    props.header.links = [
      {
        text: {en: "Status"},
        url: "/default/login",
        authenticated: true,
      },
    ];
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(isInternalLink).toHaveBeenCalledTimes(2);
    expect(isInternalLink).toHaveBeenCalledWith("/default/login");
  });

  it("should render without authenticated links when not authenticated", () => {
    props = createTestProps();
    props.isAuthenticated = false;
    props.header.links = headerLinks;
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    const linkText = getLinkText(container, ".header-link");
    expect(linkText).toContain("link-1");
    expect(linkText).toContain("link-2");
    expect(linkText).not.toContain("link-3");
  });

  it("should render with authenticated links when authenticated", () => {
    props = createTestProps();
    props.isAuthenticated = true;
    props.header.links = headerLinks;
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    const linkText = getLinkText(container, ".header-link");
    expect(linkText).toContain("link-1");
    expect(linkText).not.toContain("link-2");
    expect(linkText).toContain("link-3");
  });

  it("should render with links", () => {
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it("should not render with verified links if not verified", () => {
    props = createTestProps();
    props.isAuthenticated = true;
    props.userData.is_verified = false;
    props.header.links = headerLinks;
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    const linkText = getLinkText(container, ".header-link");
    expect(linkText).toContain("link-1");
    expect(linkText).not.toContain("link-2");
    expect(linkText).toContain("link-3");
    expect(linkText).not.toContain("link-4");
  });

  it("should render 2 links", () => {
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(container.querySelectorAll('.header-desktop-link')).toHaveLength(2);
  });

  it("should render 2 languages", () => {
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(container.querySelectorAll('.header-desktop-language-btn')).toHaveLength(2);
  });

  it("should render english as default language", () => {
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(
      container.querySelector(
        ".header-desktop-language-btn.header-language-btn-en.active",
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        ".header-desktop-language-btn.header-language-btn-it.active",
      ),
    ).not.toBeInTheDocument();
  });

  it("should render logo", () => {
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(
      container.querySelector('.header-logo-image.header-desktop-logo-image'),
    ).toBeInTheDocument();
  });

  it("should not render logo", () => {
    const logo = {
      header: {
        ...props.header,
        logo: null,
      },
    };
    props = createTestProps(logo);
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(
      container.querySelector('.header-logo-image.header-desktop-logo-image'),
    ).not.toBeInTheDocument();
  });

  it("should render sticky msg and close it on clicking close-btn", () => {
    props = createTestProps({
      header: {
        ...props.header,
        sticky_html: {
          en: "<p>announcement</p>",
        },
      },
    });
    const { container } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    expect(container.querySelector('.sticky-container')).toBeInTheDocument();
    expect(container.querySelector('.sticky-msg')).toBeInTheDocument();
    expect(container.querySelector('.sticky-msg')).toHaveTextContent('announcement');
    expect(container).toMatchSnapshot();
    expect(container.querySelector('.close-sticky-btn')).toBeInTheDocument();
    fireEvent.click(container.querySelector('.close-sticky-btn'));
    expect(container.querySelector('.sticky-container')).not.toBeInTheDocument();
    expect(container.querySelector('.sticky-msg')).not.toBeInTheDocument();
    expect(container.querySelector('.close-sticky-btn')).not.toBeInTheDocument();
  });

  it("should not show change password if login method is SAML / Social Login", () => {
    props = createTestProps();
    props.header.links = [
      {
        text: {en: "Change Password"},
        url: "/{orgSlug}/change-password",
        authenticated: true,
        methods_excluded: ["saml", "social_login"],
      },
    ];
    props.isAuthenticated = true;
    props.userData.method = "saml";
    const { container, rerender } = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    let linkText = getLinkText(container, ".header-link");
    expect(linkText).not.toContain("Change Password");
    
    props.userData.method = "social_login";
    rerender(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    linkText = getLinkText(container, ".header-link");
    expect(linkText).not.toContain("Change Password");
    
    props.userData.method = "mobile_phone";
    rerender(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    linkText = getLinkText(container, ".header-link");
    expect(linkText).toContain("Change Password");
  });
});

describe("<Header /> interactions", () => {
  let props;
  let container;

  beforeEach(() => {
    props = createTestProps();
    const result = render(
      <MemoryRouter>
        <Header {...props} />
      </MemoryRouter>
    );
    container = result.container;
  });

  it("should call setLanguage function when 'language button' is clicked", () => {
    const desktopBtn = container.querySelector(".header-language-btn-it.header-desktop-language-btn");
    fireEvent.click(desktopBtn);
    expect(props.setLanguage).toHaveBeenCalledTimes(1);
    
    const mobileBtn = container.querySelector(".header-language-btn-it.header-mobile-language-btn");
    fireEvent.click(mobileBtn);
    expect(props.setLanguage).toHaveBeenCalledTimes(2);
  });

  it("should call handleHamburger function when 'hamburger button' is clicked", () => {
    const hamburger = container.querySelector('.header-hamburger');
    fireEvent.click(hamburger);
    expect(container.querySelector('.header-mobile-menu')).toHaveClass('display-flex');
  });

  it("should call handleHamburger function on Enter key press", () => {
    const hamburger = container.querySelector('.header-hamburger');
    fireEvent.keyUp(hamburger, {keyCode: 1});
    expect(container.querySelector('.header-mobile-menu')).toHaveClass('display-none');
    fireEvent.keyUp(hamburger, {keyCode: 13});
    expect(container.querySelector('.header-mobile-menu')).toHaveClass('display-flex');
  });

  it("should dispatch to props correctly", () => {
    const dispatch = jest.fn();
    const result = mapDispatchToProps(dispatch);
    expect(result).toEqual({
      setLanguage: expect.any(Function),
    });
    result.setLanguage("en");
    expect(dispatch).toHaveBeenCalledWith({
      payload: "en",
      type: "SET_LANGUAGE",
    });
  });
});