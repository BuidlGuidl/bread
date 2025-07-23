import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, http } from "viem";
import { hardhat, mainnet } from "viem/chains";
import { createConfig } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const { targetNetworks } = scaffoldConfig;

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
export const enabledChains = targetNetworks.find((network: Chain) => network.id === 1)
  ? targetNetworks
  : ([...targetNetworks, mainnet] as const);

// Global flag to prevent multiple initializations
let _isInitializing = false;
let _wagmiConfig: ReturnType<typeof createConfig> | null = null;

export const wagmiConfig = (() => {
  if (_wagmiConfig === null && !_isInitializing) {
    _isInitializing = true;
    try {
      _wagmiConfig = createConfig({
        chains: enabledChains,
        connectors: wagmiConnectors,
        ssr: true,
        client({ chain }) {
          return createClient({
            chain,
            transport: http(getAlchemyHttpUrl(chain.id)),
            ...(chain.id !== (hardhat as Chain).id
              ? {
                  pollingInterval: scaffoldConfig.pollingInterval,
                }
              : {}),
          });
        },
      });
    } finally {
      _isInitializing = false;
    }
  }
  return _wagmiConfig!;
})();
