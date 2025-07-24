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
import { notification } from "~~/utils/scaffold-eth";

type EventWithTimestamp = {
  event: any; // The event object
  timestamp: string; // Human-readable timestamp
};

const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString();
};

const Home: NextPage = () => {
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
      {/* First row */}
      <div className="flex flex-col lg:flex-row lg:border-x-[1px] lg:border-y-[1px] border-black">
        {/* Introduction section */}
        <section className="bg-[#df57c4] p-6 lg:p-10 w-full lg:w-9/12 border-x-[1px] border-y-[1px] border-black lg:border-none overflow-auto">
          <div className="flex flex-col">
            <p className="mt-0">
              Some text about BuidlGuidl Bread here. Bread rules. It is the best bread. I look around and say
              &quot;wow&quot; BuidlGuidl Bread is the best bread. The best I&apos;ve ever had.
            </p>
          </div>
        </section>

        {/* Second row for mobile - flex row to make sections share the row */}
        <div className="flex flex-row w-full lg:w-3/12 max-h-[205px] lg:max-h-[535px]">
          {/* Transfer Interface */}
          <section className="bg-[#20F658] p-6 flex justify-center items-center border-r-[1px] border-l-[1px] border-black lg:border-r-0 flex-1">
            <Image
              src="/satellite-10fps.gif"
              alt="satellite"
              className="object-contain max-h-full"
              width={436}
              height={535}
            />
          </section>
        </div>
      </div>
      {/* Second row */}
      <div className="flex flex-col lg:flex-row border-black">
        {/* Bread Balance Section */}
        <section className="bg-[#F6F6F6] text-2xl font-semibold lg:flex-1 p-6 flex flex-col items-center lg:justify-center border-x-[1px] border-y-[1px] border-black lg:border-b-0 lg:border-t-0">
          <span>🍞 Your Bread Balance:</span>
          <span className="text-center text-2xl font-semibold mb-10">
            {breadBalance ? Number(formatEther(breadBalance)).toLocaleString() : "0"} BGBRD
          </span>
          {pendingBread !== null && (
            <>
              <span className="text-2xl font-semibold">👨‍🍳 Bread Baking:</span>
              <span> {pendingBread} BGBRD</span>
            </>
          )}
        </section>
        {/* Transfer Interface */}
        <section className="bg-[#DDDDDD] lg:flex-1 p-6 flex flex-col items-center border-x-[1px] border-b-[1px] border-black lg:border-b-0 lg:border-l-[0px]">
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

            <div className="h-2"></div>

            <button
              className={`w-full btn rounded-none text-lg font-semibold ${
                isTransferring
                  ? "btn-disabled bg-black rounded-none"
                  : transferTo && transferAmount
                  ? "bg-[#5655D5] hover:bg-[#3F3EAB] text-white border-[#5655D5] hover:border-[#3F3EAB] rounded-none"
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

      <div className="lg:grid lg:grid-cols-3 mb-10 border-t-[0px] border-black lg:border-t-[1px]">
        {/* Mint Events section */}
        <section className="col-span-3 bg-[#DDDDDD] border-x-[1px] border-black border-b-[1px] pt-6">
          <div className="flex items-center flex-col flex-grow">
            <h2 className="text-xl font-bold mb-4 text-black-500">Your Mint Events</h2>
            <div className="px-5 w-full max-w-[1200px]">
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-[#DDDDDD] px-6 py-4">
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
                            <div key={index} className="bg-black text-white rounded-none p-3">
                              <div className="flex justify-between items-center">
                                <div className="flex gap-2 items-center">
                                  <span className="text-lg font-bold text-[#df57c4]">Minted</span>
                                  <span className="text-lg">
                                    {(event.args as any)?.amount ? formatEther((event.args as any).amount) : "0"} BGBRD
                                  </span>
                                </div>
                                <span className="text-sm opacity-90">{timestamp}</span>
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
        </section>
      </div>
    </div>
  );
};

export default Home;
