/* eslint-disable prefer-promise-reject-errors */
const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const yaml = require("js-yaml");

// Test data and helpers
const configDir = path.resolve(__dirname, "../../organizations");
const testOrgSlug = "testorg";
const testOrgDir = path.join(configDir, testOrgSlug);
const testOrgConfig = path.join(testOrgDir, `${testOrgSlug}.yml`);
const testOrgCaptiveApiSlug = `${testOrgSlug}-cp-api`;
const testOrgCaptiveApiDir = path.join(configDir, testOrgCaptiveApiSlug);

const validData = {
  name: "Test Organization",
  slug: testOrgSlug,
  uuid: "test-uuid",
  secret_key: "test-secret",
  radius_realms: false,
  mobile_phone_verification: false,
  subscriptions: false,
  login_action_url: "http://localhost:8000/login/",
  logout_action_url: "http://localhost:8000/logout/",
  logout_by_session_ID: false,
  remember_me: true,
  openwisp_radius_url: "http://127.0.0.1:8000",
  assets_confirm: false,
};

const validDataWithCaptivePortalApi = {
  ...validData,
  slug: testOrgCaptiveApiSlug,
  captive_portal_api_enabled: true,
  captive_portal_api_url: "https://portal.example.com/.well-known/captive-portal",
  captive_portal_api_timeout: 3,
};

describe("add-org command", () => {
  const cleanTestOrgDir = () => {
    if (fs.existsSync(testOrgDir)) {
      fs.rmSync(testOrgDir, {recursive: true, force: true});
    }
    if (fs.existsSync(testOrgCaptiveApiDir)) {
      fs.rmSync(testOrgCaptiveApiDir, {recursive: true, force: true});
    }
  };

  beforeEach(cleanTestOrgDir);
  afterEach(cleanTestOrgDir);

  it("creates a new organization config with --noprompt and valid data", () => {
    const result = spawnSync(
      "yarn",
      ["add-org", "--noprompt", JSON.stringify(validData)],
      {encoding: "utf-8"},
    );
    expect(result.status).toBe(0);
    expect(fs.existsSync(testOrgConfig)).toBe(true);
    const config = yaml.load(fs.readFileSync(testOrgConfig, "utf8"));
    expect(config.name).toBe(validData.name);
    expect(config.slug).toBe(validData.slug);
  });

  it("fails with missing required keys in --noprompt", () => {
    const invalidData = {...validData};
    delete invalidData.name;
    const result = spawnSync(
      "yarn",
      ["add-org", "--noprompt", JSON.stringify(invalidData)],
      {encoding: "utf-8"},
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Require key\(s\) missing/);
  });

  it("prevents duplicate organization slugs", () => {
    // First creation should succeed
    let result = spawnSync(
      "yarn",
      ["add-org", "--noprompt", JSON.stringify(validData)],
      {encoding: "utf-8"},
    );
    expect(result.status).toBe(0);
    // Second creation with same slug should fail
    result = spawnSync(
      "yarn",
      ["add-org", "--noprompt", JSON.stringify(validData)],
      {
        encoding: "utf-8",
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/already exists/);
  });

  it("runs interactively and creates config (smoke test)", () => {
    // Use expect to spawn and simulate user input if possible
    // Here, just check that the process starts and prompts for input
    const proc = spawnSync("yarn", ["add-org"], {
      input: "\n", // send empty input to first prompt
      encoding: "utf-8",
      timeout: 5000,
    });
    expect(proc.stdout).toMatch(/What is the name of the organization/);
    // Should not create config file with empty input
    expect(fs.existsSync(testOrgConfig)).toBe(false);
  });

  it("creates captive portal api config with --noprompt when provided", () => {
    const orgSlug = validDataWithCaptivePortalApi.slug;
    const orgDir = path.join(configDir, orgSlug);
    const orgConfig = path.join(orgDir, `${orgSlug}.yml`);
    if (fs.existsSync(orgDir)) {
      fs.rmSync(orgDir, {recursive: true, force: true});
    }

    const result = spawnSync(
      "yarn",
      ["add-org", "--noprompt", JSON.stringify(validDataWithCaptivePortalApi)],
      {encoding: "utf-8"},
    );

    expect(result.status).toBe(0);
    expect(fs.existsSync(orgConfig)).toBe(true);
    const config = yaml.load(fs.readFileSync(orgConfig, "utf8"));
    expect(config.client.components.captive_portal_api).toEqual({
      enabled: true,
      url: "https://portal.example.com/.well-known/captive-portal",
      timeout: 3,
    });

    fs.rmSync(orgDir, {recursive: true, force: true});
  });
});
