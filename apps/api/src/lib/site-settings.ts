import {
  DEFAULT_SITE_SETTINGS,
  cloneSiteSettings,
  type SiteAboutSettings,
  type SiteBrandingSettings,
  type SiteHomeSettings,
  type SiteSearchSettings,
  type SiteSettings,
  type SiteSidebarSettings,
} from "@cloudflare-blog/shared";

const SITE_SETTINGS_ROW_ID = "public-site";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeBrandingSettings(value: unknown): SiteBrandingSettings {
  const defaults = DEFAULT_SITE_SETTINGS.branding;

  if (!isRecord(value)) {
    return { ...defaults };
  }

  return {
    siteTitle: pickString(value.siteTitle, defaults.siteTitle),
    siteAltName: pickString(value.siteAltName, defaults.siteAltName),
    siteAuthor: pickString(value.siteAuthor, defaults.siteAuthor),
    siteTagline: pickString(value.siteTagline, defaults.siteTagline),
    siteDescription: pickString(value.siteDescription, defaults.siteDescription),
  };
}

function normalizeSidebarSettings(value: unknown): SiteSidebarSettings {
  const defaults = DEFAULT_SITE_SETTINGS.sidebar;

  if (!isRecord(value)) {
    return { ...defaults };
  }

  return {
    title: pickString(value.title, defaults.title),
    description: pickString(value.description, defaults.description),
  };
}

function normalizeHomeSettings(value: unknown): SiteHomeSettings {
  const defaults = DEFAULT_SITE_SETTINGS.home;

  if (!isRecord(value)) {
    return { ...defaults };
  }

  return {
    eyebrow: pickString(value.eyebrow, defaults.eyebrow),
    title: pickString(value.title, defaults.title),
    description: pickString(value.description, defaults.description),
    featuredTitle: pickString(value.featuredTitle, defaults.featuredTitle),
    featuredDescription: pickString(value.featuredDescription, defaults.featuredDescription),
    latestTitle: pickString(value.latestTitle, defaults.latestTitle),
    latestDescription: pickString(value.latestDescription, defaults.latestDescription),
  };
}

function normalizeSearchSettings(value: unknown): SiteSearchSettings {
  const defaults = DEFAULT_SITE_SETTINGS.search;

  if (!isRecord(value)) {
    return { ...defaults };
  }

  return {
    eyebrow: pickString(value.eyebrow, defaults.eyebrow),
    title: pickString(value.title, defaults.title),
    description: pickString(value.description, defaults.description),
    placeholder: pickString(value.placeholder, defaults.placeholder),
  };
}

function normalizeAboutSettings(value: unknown): SiteAboutSettings {
  const defaults = DEFAULT_SITE_SETTINGS.about;

  if (!isRecord(value)) {
    return { ...defaults };
  }

  return {
    eyebrow: pickString(value.eyebrow, defaults.eyebrow),
    title: pickString(value.title, defaults.title),
    description: pickString(value.description, defaults.description),
    featureTitle: pickString(value.featureTitle, defaults.featureTitle),
    featureDescription: pickString(value.featureDescription, defaults.featureDescription),
    categoriesTitle: pickString(value.categoriesTitle, defaults.categoriesTitle),
    categoriesDescription: pickString(value.categoriesDescription, defaults.categoriesDescription),
  };
}

export function normalizeSiteSettings(value: unknown): SiteSettings {
  if (!isRecord(value)) {
    return cloneSiteSettings();
  }

  return {
    branding: normalizeBrandingSettings(value.branding),
    sidebar: normalizeSidebarSettings(value.sidebar),
    home: normalizeHomeSettings(value.home),
    search: normalizeSearchSettings(value.search),
    about: normalizeAboutSettings(value.about),
  };
}

export async function getSiteSettings(db: D1Database) {
  const row = await db
    .prepare("SELECT value_json FROM site_settings WHERE id = ?1 LIMIT 1")
    .bind(SITE_SETTINGS_ROW_ID)
    .first<{ value_json: string }>();

  if (!row?.value_json) {
    return cloneSiteSettings();
  }

  try {
    return normalizeSiteSettings(JSON.parse(row.value_json));
  } catch {
    return cloneSiteSettings();
  }
}

export async function updateSiteSettings(db: D1Database, input: SiteSettings) {
  const settings = normalizeSiteSettings(input);
  const now = new Date().toISOString();

  await db
    .prepare(
      `
        INSERT INTO site_settings (id, value_json, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(id) DO UPDATE
        SET value_json = excluded.value_json,
            updated_at = excluded.updated_at
      `,
    )
    .bind(SITE_SETTINGS_ROW_ID, JSON.stringify(settings), now, now)
    .run();

  return settings;
}
