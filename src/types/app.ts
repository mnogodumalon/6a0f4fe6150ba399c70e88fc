// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Reiseplanung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    reiseziel?: string;
    reisebeschreibung?: string;
    startdatum?: string; // Format: YYYY-MM-DD oder ISO String
    enddatum?: string; // Format: YYYY-MM-DD oder ISO String
    anzahl_reisende?: number;
    gesamtbudget?: number;
    waehrung?: LookupValue;
    notizen?: string;
  };
}

export interface Ausgabenkategorien {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    budgetanteil?: number;
    kategoriename?: string;
    kategorie_icon?: LookupValue;
    kategorie_beschreibung?: string;
  };
}

export interface Budgetposten {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    reise?: string; // applookup -> URL zu 'Reiseplanung' Record
    kategorie?: string; // applookup -> URL zu 'Ausgabenkategorien' Record
    bezeichnung?: string;
    geplanter_betrag?: number;
    tatsaechlicher_betrag?: number;
    ausgabendatum?: string; // Format: YYYY-MM-DD oder ISO String
    zahlungsart?: LookupValue;
    bereits_bezahlt?: boolean;
    beleg_vorhanden?: boolean;
    beleg_datei?: string;
    anmerkungen?: string;
  };
}

export const APP_IDS = {
  REISEPLANUNG: '6a0f4fcdec66e03d639ee8a3',
  AUSGABENKATEGORIEN: '6a0f4fd4d37bb65dc3e2470c',
  BUDGETPOSTEN: '6a0f4fd5f913a3aa3d026472',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'reiseplanung': {
    waehrung: [{ key: "eur", label: "Euro (€)" }, { key: "usd", label: "US-Dollar ($)" }, { key: "gbp", label: "Britisches Pfund (£)" }, { key: "chf", label: "Schweizer Franken (CHF)" }, { key: "jpy", label: "Japanischer Yen (¥)" }, { key: "aud", label: "Australischer Dollar (AUD)" }, { key: "sonstige", label: "Sonstige" }],
  },
  'ausgabenkategorien': {
    kategorie_icon: [{ key: "transport", label: "Transport" }, { key: "verpflegung", label: "Verpflegung" }, { key: "aktivitaeten", label: "Aktivitäten & Ausflüge" }, { key: "einkaufe", label: "Einkäufe & Shopping" }, { key: "versicherung", label: "Versicherung" }, { key: "kommunikation", label: "Kommunikation" }, { key: "gesundheit", label: "Gesundheit" }, { key: "sonstiges", label: "Sonstiges" }, { key: "unterkunft", label: "Unterkunft" }],
  },
  'budgetposten': {
    zahlungsart: [{ key: "bargeld", label: "Bargeld" }, { key: "kreditkarte", label: "Kreditkarte" }, { key: "ec_karte", label: "EC-Karte" }, { key: "online", label: "Online-Zahlung" }, { key: "ueberweisung", label: "Überweisung" }, { key: "sonstige", label: "Sonstige" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'reiseplanung': {
    'reiseziel': 'string/text',
    'reisebeschreibung': 'string/textarea',
    'startdatum': 'date/date',
    'enddatum': 'date/date',
    'anzahl_reisende': 'number',
    'gesamtbudget': 'number',
    'waehrung': 'lookup/select',
    'notizen': 'string/textarea',
  },
  'ausgabenkategorien': {
    'budgetanteil': 'number',
    'kategoriename': 'string/text',
    'kategorie_icon': 'lookup/select',
    'kategorie_beschreibung': 'string/textarea',
  },
  'budgetposten': {
    'reise': 'applookup/select',
    'kategorie': 'applookup/select',
    'bezeichnung': 'string/text',
    'geplanter_betrag': 'number',
    'tatsaechlicher_betrag': 'number',
    'ausgabendatum': 'date/date',
    'zahlungsart': 'lookup/select',
    'bereits_bezahlt': 'bool',
    'beleg_vorhanden': 'bool',
    'beleg_datei': 'file',
    'anmerkungen': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateReiseplanung = StripLookup<Reiseplanung['fields']>;
export type CreateAusgabenkategorien = StripLookup<Ausgabenkategorien['fields']>;
export type CreateBudgetposten = StripLookup<Budgetposten['fields']>;