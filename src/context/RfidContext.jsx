import React, { createContext, useContext, useState, useCallback } from 'react';

const RfidContext = createContext();

const STORAGE_KEY = 'rfid_aliases';

const loadAliases = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const RfidProvider = ({ children }) => {
  const [aliases, setAliases] = useState(loadAliases);

  const setAlias = useCallback((rfid, name) => {
    setAliases((prev) => {
      const updated = { ...prev, [rfid.toUpperCase()]: name.trim() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeAlias = useCallback((rfid) => {
    setAliases((prev) => {
      const updated = { ...prev };
      delete updated[rfid.toUpperCase()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  /** Returns the friendly name for an RFID, or the raw RFID if not mapped */
  const resolveName = useCallback(
    (rfid) => aliases[rfid?.toUpperCase()] || rfid,
    [aliases]
  );

  return (
    <RfidContext.Provider value={{ aliases, setAlias, removeAlias, resolveName }}>
      {children}
    </RfidContext.Provider>
  );
};

export const useRfid = () => useContext(RfidContext);
