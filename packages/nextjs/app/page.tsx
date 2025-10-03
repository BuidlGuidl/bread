"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import axios from "axios";
import { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { AddressInput, InputBase } from "~~/components/scaffold-eth";
import {
  useScaffoldReadContract,
  useScaffoldWatchContractEvent,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const Home: NextPage = () => {
  // Helper function to format numbers with conditional decimal places
  const formatBreadAmount = (amount: number): string => {
    // Check if the number has decimal places
    const hasDecimals = amount % 1 !== 0;

    if (hasDecimals) {
      // Show 2 decimal places for numbers with decimals
      return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      // Show no decimal places for whole numbers
      return amount.toLocaleString();
    }
  };

  // Bread-related state
  const { address: connectedAddress } = useAccount();
  const {
    data: ensName,
    isLoading: ensLoading,
    error: ensError,
  } = useEnsName({
    address: connectedAddress,
    chainId: mainnet.id,
  });
  const [pendingBread, setPendingBread] = useState<number | null>(null);

  // Nodes state
  interface NodeData {
    nodeId: string;
    executionClient: string;
    consensusClient: string;
    blockNumber: number;
    isFollowingHead: boolean;
    nExecutionPeers: string;
    nConsensusPeers: string;
  }

  interface NodesResponse {
    nodesOnline: number;
    nodes: NodeData[];
  }

  const [nodesData, setNodesData] = useState<NodesResponse | null>(null);

  // Transfer state
  const [transferTo, setTransferTo] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: breadBalance, refetch: refetchBalance } = useScaffoldReadContract({
    contractName: "BuidlGuidlBread",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { writeContractAsync: writeBreadContract } = useScaffoldWriteContract("BuidlGuidlBread");

  // Watch for Transfer events to update balance automatically
  useScaffoldWatchContractEvent({
    contractName: "BuidlGuidlBread",
    eventName: "Transfer",
    onLogs: logs => {
      logs.forEach(log => {
        const { from, to } = log.args as any;
        // Refetch balance if the connected user is either sender or receiver
        if (from === connectedAddress || to === connectedAddress) {
          refetchBalance();
        }
      });
    },
  });

  // Set up interval to fetch pending bread every 5 seconds
  // Note: API always uses address, not ENS names
  useEffect(() => {
    if (!connectedAddress) {
      setPendingBread(null);
      return;
    }

    // Fetch pending bread amount from API
    const fetchPendingBread = async (address: string, ensName?: string | null) => {
      try {
        // Always use address for the API call (ENS not supported by the endpoint)
        const queryParam = address;
        console.log("Fetching pending bread for:", queryParam, "(ENS:", ensName, "Address:", address, ")");
        console.log("ENS Loading:", ensLoading, "ENS Error:", ensError);
        const response = await axios.get(
          `https://pool.mainnet.rpc.buidlguidl.com:48546/yourpendingbread?owner=${queryParam}`,
        );
        console.log("API Response:", response.data);
        console.log("API Response bread value:", response.data.bread, "Type:", typeof response.data.bread);
        // Handle both number and string responses from the API
        const breadValue = response.data.bread;
        if (typeof breadValue === "number") {
          return breadValue;
        } else if (typeof breadValue === "string") {
          const parsed = parseFloat(breadValue);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      } catch (error) {
        console.error(`Error fetching pending bread: ${error}`);
        console.error("Full error:", error);
        return null;
      }
    };

    // Function to fetch with current ENS name or address
    const fetchWithCurrentParams = () => {
      fetchPendingBread(connectedAddress, ensName).then(setPendingBread);
    };

    // Fetch immediately
    fetchWithCurrentParams();

    // Set up interval for every 5 seconds (only fetches pending bread, ENS is cached)
    const interval = setInterval(fetchWithCurrentParams, 5000);

    // Cleanup interval on unmount or address change
    return () => clearInterval(interval);
  }, [connectedAddress, ensName, ensLoading, ensError]);

  // Fetch nodes data when wallet is connected
  useEffect(() => {
    if (!connectedAddress) {
      setNodesData(null);
      return;
    }

    const fetchNodesData = async () => {
      try {
        const response = await axios.get<NodesResponse>(
          `https://pool.mainnet.rpc.buidlguidl.com:48547/yournodes?owner=${connectedAddress}`,
        );
        setNodesData(response.data);
      } catch (error) {
        console.error("Error fetching nodes data:", error);
        setNodesData(null);
      }
    };

    // Fetch immediately
    fetchNodesData();

    // Set up interval to fetch every 10 seconds
    const interval = setInterval(fetchNodesData, 15000);

    // Cleanup interval on unmount or address change
    return () => clearInterval(interval);
  }, [connectedAddress]);

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount || !connectedAddress) {
      notification.error("Please fill in all fields");
      return;
    }

    try {
      setIsTransferring(true);

      const amountInWei = parseEther(transferAmount);

      // Check if user has enough balance
      if (breadBalance && amountInWei > breadBalance) {
        notification.error("Insufficient balance");
        return;
      }

      await writeBreadContract({
        functionName: "transfer",
        args: [transferTo as `0x${string}`, amountInWei],
      });

      notification.success("Transfer successful!");

      // Clear form
      setTransferTo("");
      setTransferAmount("");
    } catch (error: any) {
      console.error("Transfer error:", error);
      notification.error("Transfer failed: " + (error?.message || "Unknown error"));
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="container mx-auto">
      {/* First row */}
      <div className="flex flex-col lg:flex-row lg:border-x-[1px] lg:border-y-[1px] bg-black border-black">
        {/* Introduction section */}
        <section className="bg-[#F6F6F6] p-6 lg:p-10 w-full lg:w-7/12 border-x-[1px] border-y-[1px] border-black lg:border-none overflow-auto">
          <div className="flex flex-col">
            <p className="mt-0">
              BuidlGuidl Bread (
              <a
                href="https://basescan.org/address/0xF9206cA52a336Fba43264bc6822046D60aEdfc3C"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                BGBRD
              </a>
              ) is an ERC-20 token that rewards community members who run a{" "}
              <a href="https://client.buidlguidl.com/" target="_blank" rel="noreferrer" className="link">
                BG Client node
              </a>{" "}
              and choose to participate in powering the distributed{" "}
              <a href="https://rpc.buidlguidl.com/" target="_blank" rel="noreferrer" className="link">
                BG RPC
              </a>
              . Supporting the{" "}
              <a href="https://rpc.buidlguidl.com/" target="_blank" rel="noreferrer" className="link">
                BG RPC
              </a>{" "}
              strengthens the reliability, decentralization, and resilience of infrastructure that serves developers and
              dApps.
            </p>
          </div>
        </section>

        {/* Second row for mobile - flex row to make sections share the row */}
        <div className="flex flex-row w-full bg-black lg:w-5/12 h-[225px] lg:h-[394px]">
          {/* Oven GIF Section */}
          <section className="bg-black flex justify-center items-center border-r-[1px] border-l-[1px] border-black lg:border-r-0 flex-1 overflow-hidden">
            <div className="w-full h-full flex justify-center items-center">
              <Image
                src="/bg-oven-382px-394px-32c.gif"
                alt="BG oven"
                className="object-contain w-full h-full"
                width={436}
                height={394}
                priority
                sizes="(max-width: 1024px) 50vw, 436px"
              />
            </div>
          </section>
        </div>
      </div>
      {/* Second row */}
      <div
        className={`flex flex-col lg:flex-row border-black lg:border-x-[1px] lg:border-b-[1px] ${
          connectedAddress ? "mb-0" : "mb-10"
        }`}
      >
        {/* Bread Balance Section */}
        <section className="bg-[#ff67f9] text-2xl font-semibold lg:w-5/12 px-6 py-12 lg:py-6 flex flex-col items-center justify-center border-x-[1px] border-y-[1px] border-black lg:border-b-0 lg:border-t-0 lg:border-l-0">
          <span>🍞 Your Bread Balance:</span>
          {!connectedAddress ? (
            <span className="text-center text-lg">Connect your wallet to see bread balance</span>
          ) : (
            <span className="text-center text-2xl font-semibold mb-10">
              {breadBalance ? formatBreadAmount(Number(formatEther(breadBalance))) : "0"} BGBRD
            </span>
          )}
          {pendingBread !== null && (
            <>
              <span className="text-2xl font-semibold">👨‍🍳 Bread Baking:</span>
              <span> {formatBreadAmount(pendingBread)} BGBRD</span>
            </>
          )}
        </section>
        {/* Transfer Interface */}
        <section className="bg-[#DDDDDD] lg:w-7/12 p-6 flex flex-col items-center border-x-[1px] border-b-[1px] border-black lg:border-b-0 lg:border-x-[0px]">
          <h2 className="text-xl font-bold mb-4 text-black-500">Transfer Bread</h2>
          <div className={`space-y-4 mb-8 w-full max-w-xl ${!connectedAddress ? "pointer-events-none" : ""}`}>
            <div>
              <label className="block text-sm font-medium mb-2">Recipient Address</label>
              <AddressInput value={transferTo} onChange={setTransferTo} placeholder="Enter recipient address" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <InputBase
                name="transferAmount"
                value={transferAmount}
                onChange={setTransferAmount}
                placeholder="0"
                prefix={<span className="pl-4 -mr-2 text-accent self-center">🍞</span>}
              />
            </div>

            <div className="h-2"></div>

            <button
              className={`w-full btn rounded-none text-lg text-black font-chivo font-normal ${
                isTransferring
                  ? "btn-disabled bg-black rounded-none"
                  : transferTo && transferAmount
                  ? "bg-white border-black hover:bg-[#ee5de9] rounded-none"
                  : "btn-primary bg-black rounded-none"
              }`}
              onClick={handleTransfer}
              disabled={!connectedAddress || isTransferring || !transferTo || !transferAmount}
            >
              {isTransferring ? (
                <span className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm"></span>
                  Transferring...
                </span>
              ) : (
                "Transfer Bread"
              )}
            </button>
          </div>
        </section>
      </div>
      {connectedAddress && (
        <div className="flex flex-col lg:flex-row border-black border-x-[1px] border-b-[1px] mb-10">
          {/* Your Nodes Info Section */}
          <section className="bg-[#f6f6f6] w-full p-6 flex flex-col">
            <span className="text-xl font-bold mb-8 text-center">Your Nodes ({nodesData?.nodes.length})</span>
            {nodesData === null ? (
              <div className="text-center text-gray-600">Loading nodes data...</div>
            ) : nodesData.nodes.length === 0 ? (
              <div className="text-center text-gray-600 pb-10">No nodes found for this address</div>
            ) : (
              <div className="space-y-4">
                {nodesData.nodes.map((node, index) => (
                  <div key={index} className="bg-white p-4 rounded-none border border-gray-300">
                    <div className="grid grid-cols-1 text-sm mb-4">
                      <div className="font-semibold mx-auto">
                        <span>Node ID: </span>
                        <span>{node.nodeId}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-semibold">Block Number: </span>
                        <span>{node.blockNumber.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Following Chain: </span>
                        <span className={node.isFollowingHead ? "text-green-600" : "text-red-600"}>
                          {node.isFollowingHead ? "Yes" : "No"}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">
                          <span className="lg:hidden">E Client: </span>
                          <span className="hidden lg:inline">Execution Client: </span>
                        </span>
                        <span>
                          {node.executionClient} (peers: {node.nExecutionPeers})
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">
                          <span className="lg:hidden">C Client: </span>
                          <span className="hidden lg:inline">Consensus Client: </span>
                        </span>
                        <span>
                          {node.consensusClient} (peers: {node.nConsensusPeers})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default Home;
