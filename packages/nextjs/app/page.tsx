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
      <div className="flex flex-col lg:flex-row border-black lg:border-b-[1px] mb-10">
        {/* Bread Balance Section */}
        <section className="bg-[#F6F6F6] text-2xl font-semibold lg:w-5/12 p-6 flex flex-col items-center lg:justify-center border-x-[1px] border-y-[1px] border-black lg:border-b-0 lg:border-t-0">
          <span>🍞 Your Bread Balance:</span>
          {!connectedAddress ? (
            <span className="text-center text-lg mb-10">Connect your wallet to see your bread balance</span>
          ) : (
            <span className="text-center text-2xl font-semibold mb-10">
              {breadBalance ? Number(formatEther(breadBalance)).toLocaleString() : "0"} BGBRD
            </span>
          )}
          {pendingBread !== null && (
            <>
              <span className="text-2xl font-semibold">👨‍🍳 Bread Baking:</span>
              <span> {pendingBread} BGBRD</span>
            </>
          )}
        </section>
        {/* Transfer Interface */}
        <section className="bg-[#DDDDDD] lg:w-7/12 p-6 flex flex-col items-center border-x-[1px] border-b-[1px] border-black lg:border-b-0 lg:border-l-[0px]">
          <h2 className="text-xl font-bold mb-4 text-black-500">Transfer Bread</h2>
          <div className="space-y-4 w-full max-w-xl">
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
                  ? "bg-white border-black hover:bg-[#7877FF] rounded-none"
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
    </div>
  );
};

export default Home;
