"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import axios from "axios";
import { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount, useEnsName, usePublicClient } from "wagmi";
import { mainnet } from "wagmi/chains";
import { AddressInput, InputBase } from "~~/components/scaffold-eth";
import {
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWatchContractEvent,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import liveTag from "~~/public/live-tag.svg";
import map from "~~/public/map.png";
import { notification } from "~~/utils/scaffold-eth";

interface ContinentData {
  "North America": number;
  "South America": number;
  Europe: number;
  Asia: number;
  Africa: number;
  Australia: number;
}

type EventWithTimestamp = {
  event: any; // The event object
  timestamp: string; // Human-readable timestamp
};

const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString();
};

const Home: NextPage = () => {
  const [continentData, setContinentData] = useState<ContinentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  const publicClient = usePublicClient();
  const [mintEventsWithTime, setMintEventsWithTime] = useState<EventWithTimestamp[]>([]);
  const [pendingBread, setPendingBread] = useState<number | null>(null);

  // Transfer state
  const [transferTo, setTransferTo] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: breadBalance } = useScaffoldReadContract({
    contractName: "BuidlGuidlBread",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { writeContractAsync: writeBreadContract } = useScaffoldWriteContract("BuidlGuidlBread");

  const { data: mintEvents } = useScaffoldEventHistory({
    contractName: "BuidlGuidlBread",
    eventName: "BatchMint",
    fromBlock: 0n,
    filters: connectedAddress ? { user: connectedAddress as `0x${string}` } : undefined,
  });

  // Debug logging
  useEffect(() => {
    console.log("Connected address:", connectedAddress);
    console.log("Mint events:", mintEvents);
    if (mintEvents) {
      console.log("Number of mint events:", mintEvents.length);
      mintEvents.forEach((event, index) => {
        console.log(`Event ${index}:`, {
          user: (event.args as any)?.user,
          amount: (event.args as any)?.amount,
          blockNumber: event.log?.blockNumber,
        });
      });
    }
  }, [mintEvents, connectedAddress]);

  // Listen for new BatchMint events
  useScaffoldWatchContractEvent({
    contractName: "BuidlGuidlBread",
    eventName: "BatchMint",
    onLogs: logs => {
      logs.forEach(async log => {
        // Only add events for the connected user
        if ((log.args as any)?.user === connectedAddress) {
          try {
            const block = log.blockNumber ? await publicClient?.getBlock({ blockNumber: log.blockNumber }) : null;
            const newEventWithTime = {
              event: log,
              timestamp: block ? formatTimestamp(Number(block.timestamp)) : "Unknown time",
            };

            setMintEventsWithTime(prev => {
              // Check if event already exists to avoid duplicates
              const exists = prev.some(
                item =>
                  item.event.blockNumber === log.blockNumber && item.event.transactionHash === log.transactionHash,
              );
              if (!exists) {
                // Add new event at the beginning (most recent first)
                return [newEventWithTime, ...prev];
              }
              return prev;
            });
          } catch (error) {
            console.error("Error processing new batch mint event:", error);
          }
        }
      });
    },
  });

  // Original continent data fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("https://pool.mainnet.rpc.buidlguidl.com:48547/nodecontinents");
        const data = await response.json();
        setContinentData(data.continents);
      } catch (error) {
        console.error("Error fetching continent data:", error);
      }
    };

    fetchData();
  }, []);

  // Clear events when wallet disconnects and handle events when connected
  useEffect(() => {
    if (!connectedAddress) {
      setMintEventsWithTime([]);
      return;
    }

    // Only process events if we have a connected address and events exist
    if (!mintEvents) {
      return;
    }

    const fetchBlockTimestamps = async () => {
      if (!publicClient) return;

      // Sort events by block number (most recent first)
      const sortedMintEvents = [...(mintEvents || [])].sort(
        (a, b) => Number(b.log.blockNumber) - Number(a.log.blockNumber),
      );

      // Fetch timestamps for mint events
      const mintPromises = sortedMintEvents.map(async event => {
        try {
          const block = await publicClient.getBlock({ blockNumber: event.log.blockNumber });
          return {
            event,
            timestamp: formatTimestamp(Number(block.timestamp)),
          };
        } catch (error) {
          console.error("Error fetching block:", error);
          return {
            event,
            timestamp: "Unknown time",
          };
        }
      });

      const mintResults = await Promise.all(mintPromises);

      setMintEventsWithTime(mintResults);
    };

    fetchBlockTimestamps();
  }, [connectedAddress, mintEvents, publicClient]);

  // Set up interval to fetch pending bread every 5 seconds
  // Note: ENS resolution happens automatically via useEnsName hook and only when address changes
  useEffect(() => {
    if (!connectedAddress) {
      setPendingBread(null);
      return;
    }

    // Fetch pending bread amount from API
    const fetchPendingBread = async (address: string, ensName?: string | null) => {
      try {
        // Use ENS name if available, otherwise use address
        const queryParam = ensName || address;
        console.log("Fetching pending bread for:", queryParam, "(ENS:", ensName, "Address:", address, ")");
        console.log("ENS Loading:", ensLoading, "ENS Error:", ensError);
        const response = await axios.get(
          `https://pool.mainnet.rpc.buidlguidl.com:48546/yourpendingbread?owner=${queryParam}`,
        );
        console.log("API Response:", response.data);
        console.log("API Response bread value:", response.data.bread, "Type:", typeof response.data.bread);
        // Ensure we return a number or null
        return typeof response.data.bread === "number" ? response.data.bread : null;
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
      {/* ORIGINAL LANDING PAGE CONTENT */}
      {/* First row */}
      <div className="flex flex-col lg:flex-row lg:border-x-[1px] lg:border-y-[1px] border-black">
        {/* Introduction section */}
        <section className="bg-[#df57c4] p-6 lg:p-10 w-full lg:w-[45vw] border-x-[1px] border-y-[1px] border-black lg:border-none overflow-auto">
          <div className="flex flex-col">
            <p className="mt-0">Some text about BuidlGuidl Bread here</p>
          </div>
        </section>

        {/* Second row for mobile - flex row to make sections share the row */}
        <div className="flex flex-row flex-1">
          {/* Transfer Interface */}
          <section className="bg-[#DDDDDD] lg:flex-1 p-6 flex flex-col items-center border-x-[1px] border-b-[1px] border-black lg:border-b-0 lg:border-r-0">
            <span>🍞 Bread Balance:</span>
            <span className="text-center sm:text-left">
              {breadBalance ? Number(formatEther(breadBalance)).toLocaleString() : "0"} BGBRD
            </span>
            {pendingBread !== null && <p className="text-2xl font-semibold">👨‍🍳 Pending: {pendingBread} BGBRD</p>}
          </section>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:border-x-[1px] lg:border-y-[1px] border-black">
        {/* Introduction section */}
        <section className="bg-[#df57c4] p-6 lg:p-10 w-full lg:w-[45vw] border-x-[1px] border-y-[1px] border-black lg:border-none overflow-auto">
          <div className="flex flex-col">
            <p className="mt-0">Some text about BuidlGuidl Bread here</p>
          </div>
        </section>

        {/* Second row for mobile - flex row to make sections share the row */}
        <div className="flex flex-row flex-1">
          {/* Transfer Interface */}
          <section className="bg-[#DDDDDD] lg:flex-1 p-6 flex flex-col items-center border-x-[1px] border-b-[1px] border-black lg:border-b-0 lg:border-r-0">
            <h2 className="text-xl font-bold mb-4 text-black-500">Transfer Bread</h2>
            <div className="space-y-4 w-full max-w-md">
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
                  placeholder="0.0"
                  prefix={<span className="pl-4 -mr-2 text-accent self-center">🍞</span>}
                />
              </div>

              <button
                className={`w-full btn rounded-none bg-black text-lg font-semibold ${
                  isTransferring
                    ? "btn-disabled rounded-none"
                    : transferTo && transferAmount
                    ? "bg-blue-400 hover:bg-blue-500 text-white border-blue-400 hover:border-blue-500 rounded-none"
                    : "btn-primary rounded-none"
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
      </div>

      {/* Second row */}
      <div className="lg:grid lg:grid-cols-3 mb-10">
        {/* Map section */}
        <section className="col-span-2 bg-[#F6F6F6] p-6 lg:p-10 border-x-[1px] border-black lg:border-b-[1px]">
          <div className="flex flex-row items-center gap-4">
            <h1 className="text-lg m-0">📡 Clients running</h1>
            <Image src={liveTag} alt="live tag" className="w-16 animate-pulse-fast" />
          </div>
          <div className="relative flex items-center justify-center pt-10">
            <Image src={map} alt="map" />
            {/* Continent tags */}
            <div className="text-xs md:text-sm lg:text-base flex items-center justify-center">
              <div className="bg-[#f359d4] lg:px-3 leading-none absolute top-[26%] right-[33%] lg:right-[37%]">
                <p className="m-2 xl:my-3 text-center whitespace-nowrap">europe ({continentData?.Europe ?? "..."})</p>
              </div>
              <div className="bg-[#f359d4] lg:px-3 leading-none absolute top-[35%] right-[14%] xl:right-[18%] lg:top-[30%]">
                <p className="m-2 xl:my-3 text-center whitespace-nowrap">asia ({continentData?.Asia ?? "..."})</p>
              </div>
              <div className="bg-[#f359d4] lg:px-3 leading-none absolute top-[32%] left-[5%] lg:left-[6%] xl:left-[9%]">
                <p className="m-2 xl:my-3 text-center whitespace-nowrap">
                  north america ({continentData?.["North America"] ?? "..."})
                </p>
              </div>
              <div className="bg-[#f359d4] lg:px-3 leading-none absolute bottom-[20%] left-[15%] xl:left-[20%]">
                <p className="m-2 xl:my-3 text-center whitespace-nowrap">
                  south america ({continentData?.["South America"] ?? "..."})
                </p>
              </div>
              <div className="bg-[#f359d4] lg:px-3 leading-none absolute bottom-[35%] left-[43%] lg:left-[45%]">
                <p className="m-2 xl:my-3 text-center whitespace-nowrap">africa ({continentData?.Africa ?? "..."})</p>
              </div>
              <div className="bg-[#f359d4] lg:px-3 leading-none absolute bottom-[10%] right-[5%] lg:bottom-[13%]">
                <p className="m-2 xl:my-3 text-center whitespace-nowrap">
                  australia ({continentData?.Australia ?? "..."})
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Docs section */}
        <section className="bg-black p-6 lg:p-10 text-white">
          <h1 className="text-lg">Useful links | Docs</h1>
          <ul className="list-disc list-outside pl-4">
            <li className="my-4">
              <a href="https://github.com/BuidlGuidl/buidlguidl-client" className="link">
                BuidlGuidl Client Repo
              </a>
            </li>
            <li className="my-4">
              <a href="https://docs.rocketpool.net/guides/node/local/hardware" className="link">
                Node Hardware Guide (Rocket Pool)
              </a>
            </li>
            <li className="my-4">
              <a href="https://gist.github.com/yorickdowne/f3a3e79a573bf35767cd002cc977b038" className="link">
                SSD Selection Guide
              </a>
            </li>
            <li className="my-4">
              <a href="https://reth.rs/" className="link">
                Reth Docs
              </a>
            </li>
            <li className="my-4">
              <a href="https://lighthouse-book.sigmaprime.io/" className="link">
                Lighthouse Docs
              </a>
            </li>
            <li className="my-4">
              <a href="https://geth.ethereum.org/docs" className="link">
                Geth Docs
              </a>
            </li>
            <li className="my-4">
              <a href="https://docs.prylabs.network/docs/getting-started" className="link">
                Prysm Docs
              </a>
            </li>
          </ul>
        </section>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-85 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <Image
              src="/screenshot-3-modal.png"
              alt="screenshot"
              className="object-contain"
              width={2030}
              height={1327}
              onClick={e => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* NEW BREAD FUNCTIONALITY SECTION - ADDED TO BOTTOM */}
      <div className="border-t-[1px] border-black pt-10 mt-10">
        <div className="flex items-center flex-col flex-grow pt-10">
          <div className="px-5 w-full max-w-[1200px]">
            <div className="grid grid-cols-1 gap-4">
              {/* Mint Events */}
              <div className="bg-base-300 rounded-3xl px-6 py-4">
                <h2 className="text-xl font-bold mb-4 text-green-500">Mint Events</h2>
                <div className="h-[300px] md:h-[600px] overflow-y-auto">
                  {!connectedAddress ? (
                    <p className="text-center text-lg">Connect your wallet to see your mint events</p>
                  ) : mintEventsWithTime.length === 0 ? (
                    <p className="text-center text-lg">No mint events found for your address</p>
                  ) : (
                    <div className="space-y-3">
                      {mintEventsWithTime
                        .filter(
                          ({ event }) => (event.args as any)?.user?.toLowerCase() === connectedAddress.toLowerCase(),
                        )
                        .map(({ event, timestamp }, index) => (
                          <div key={index} className="bg-base-100 rounded-xl p-3">
                            <div className="flex justify-between items-center">
                              <div className="flex gap-2 items-center">
                                <span className="text-lg font-bold text-green-500">Minted</span>
                                <span className="text-lg">
                                  {(event.args as any)?.amount ? formatEther((event.args as any).amount) : "0"} BGBRD
                                </span>
                              </div>
                              <span className="text-sm opacity-70">{timestamp}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
