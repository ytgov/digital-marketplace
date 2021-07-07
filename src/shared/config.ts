export function parseBooleanEnvironmentVariable(raw?: string): boolean | null {
  switch (raw) {
    case '1': return true;
    case '0': return false;
    default: return null;
  }
}

export const SHOW_TEST_INDICATOR = parseBooleanEnvironmentVariable(process.env.SHOW_TEST_INDICATOR) || false;

export const CONTACT_EMAIL = 'digital-marketplace@yukon.ca';

export const GOV_IDP_SUFFIX = 'azure-ad';

export const GOV_IDP_NAME = 'YNET';

export const VENDOR_IDP_SUFFIX = 'github';

export const VENDOR_IDP_NAME = 'GitHub';

export const TIMEZONE = 'America/Vancouver';

export const CWU_MAX_BUDGET = 50000;

export const SWU_MAX_BUDGET = 50000;

export const COPY = {
  appTermsTitle: 'Digital Marketplace Terms & Conditions for E-Bidding',
  gov: {
    name: {
      short: 'Yukon Government',
      long: 'Government of Yukon'
    }
  },
  region: {
    name: {
      short: 'Yukon',
      long: 'Yukon'
    }
  }
};

export const EMPTY_STRING = '—'; // emdash

export const DEFAULT_PAGE_SIZE = 20;
