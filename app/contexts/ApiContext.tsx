import { ApiPromise, WsProvider } from '@polkadot/api';
import React, { createContext, useContext, useEffect, useState } from 'react';

type ApiContextType = {
  api: ApiPromise | null;
  isApiReady: boolean;
};

const ApiContext = createContext<ApiContextType>({ api: null, isApiReady: false });

let apiPromise: Promise<any> | null = null;
let provider: any = null;

export function getApi() {
  if (!apiPromise) {
    provider = new WsProvider('wss://sys.ibp.network/asset-hub-paseo');
    apiPromise = ApiPromise.create({ provider });
  }
  return apiPromise;
}

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    let retryTimeout: number | null = null;

    const connect = async () => {
      try {
        const apiInstance = await getApi();
        if (mounted) {
          setApi(apiInstance);
          setIsApiReady(true);
        }
      } catch (err) {
        console.error(`Failed to connect to Polkadot API (attempt ${retryCount + 1}):`, err);
        if (mounted && retryCount < maxRetries) {
          retryCount++;
          retryTimeout = setTimeout(connect, retryDelay);
        }
      }
    };
    connect();

    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, []);

  return (
    <ApiContext.Provider value={{ api, isApiReady }}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = () => useContext(ApiContext);

export default ApiProvider;