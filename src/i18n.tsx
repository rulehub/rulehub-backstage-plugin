import React, { createContext, useContext, PropsWithChildren, useMemo } from 'react';
import en from './locales/en/messages.json';

/** @public */
export type Messages = Record<string, string>;

interface I18nContextValue {
  t: (_: string) => string;
}

const defaultMessages: Messages = en as Messages;

const I18nContext = createContext<I18nContextValue>({
  t: (k: string) => defaultMessages[k] ?? k,
});

/** @public */
export interface I18nProviderProps extends PropsWithChildren<{}> {
  messages?: Messages;
}

/** @public */
export const I18nProvider = ({ children, messages }: I18nProviderProps) => {
  const merged = useMemo<Messages>(() => ({ ...defaultMessages, ...(messages ?? {}) }), [messages]);
  const value = useMemo<I18nContextValue>(() => ({ t: (k: string) => merged[k] ?? k }), [merged]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/** @public */
export const useI18n = () => useContext(I18nContext);
