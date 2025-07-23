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

// Global flag to prevent multiple initializations
let _isInitializing = false;
let _wagmiConnectors: ReturnType<typeof connectorsForWallets> | null = null;

/**
 * wagmi connectors for the wagmi context
 * Enhanced with global initialization flag to prevent React Strict Mode issues
 */
export const wagmiConnectors = (() => {
  if (_wagmiConnectors === null && !_isInitializing) {
    _isInitializing = true;
    try {
      _wagmiConnectors = connectorsForWallets(
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
    } finally {
      _isInitializing = false;
    }
  }
  return _wagmiConnectors!;
})();
