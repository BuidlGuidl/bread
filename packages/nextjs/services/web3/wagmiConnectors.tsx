import { burnerWalletConfig } from "./wagmi-burner/burnerWalletConfig";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import * as chains from "viem/chains";
import scaffoldConfig from "~~/scaffold.config";

const { onlyLocalBurnerWallet, targetNetworks } = scaffoldConfig;

const wallets = [
  metaMaskWallet,
  walletConnectWallet,
  ledgerWallet,
  coinbaseWallet,
  rainbowWallet,
  safeWallet,
  ...(!targetNetworks.some(network => network.id !== (chains.hardhat as chains.Chain).id) || !onlyLocalBurnerWallet
    ? [burnerWalletConfig]
    : []),
];

// Store the singleton instance on globalThis to persist across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __scaffoldEthWagmiConnectors: ReturnType<typeof connectorsForWallets> | undefined;
}

/**
 * wagmi connectors for the wagmi context
 * Uses a global singleton pattern that persists across hot reloads
 */
function createWagmiConnectors() {
  if (globalThis.__scaffoldEthWagmiConnectors) {
    return globalThis.__scaffoldEthWagmiConnectors;
  }

  const connectors = connectorsForWallets(
    [
      {
        groupName: "Supported Wallets",
        wallets,
      },
    ],
    {
      appName: "scaffold-eth-2",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  );

  globalThis.__scaffoldEthWagmiConnectors = connectors;
  return connectors;
}

export const wagmiConnectors = createWagmiConnectors();
