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

// Store the singleton instance on globalThis to persist across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __scaffoldEthWagmiConfig: ReturnType<typeof createConfig> | undefined;
}

/**
 * wagmi config for the wagmi context
 * Uses a global singleton pattern that persists across hot reloads
 */
function createWagmiConfig() {
  if (globalThis.__scaffoldEthWagmiConfig) {
    return globalThis.__scaffoldEthWagmiConfig;
  }

  const config = createConfig({
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

  globalThis.__scaffoldEthWagmiConfig = config;
  return config;
}

export const wagmiConfig = createWagmiConfig();
