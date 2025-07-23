"use client";

import { formatEther } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerTxLink } from "~~/utils/scaffold-eth";

const EventsPage = () => {
  const { targetNetwork } = useTargetNetwork();

  const { data: batchMintEvents, isLoading: isBatchMintLoading } = useScaffoldEventHistory({
    contractName: "BuidlGuidlBread",
    eventName: "BatchMint",
    fromBlock: 0n,
    watch: true,
    blockData: true,
  });

  const { data: ownerMintEvents, isLoading: isOwnerMintLoading } = useScaffoldEventHistory({
    contractName: "BuidlGuidlBread",
    eventName: "OwnerMint",
    fromBlock: 0n,
    watch: true,
    blockData: true,
  });

  return (
    <div className="flex flex-col items-center py-10 px-5 sm:px-0 lg:py-20 max-w-[1000px] mx-auto">
      <h1 className="text-4xl font-bold mb-8">Contract Events</h1>

      {/* Owner Mint Events */}
      <div className="w-full mb-12">
        <h2 className="text-2xl font-bold mb-4 text-orange-500">Owner Mint Events</h2>
        {isOwnerMintLoading ? (
          <div className="flex justify-center items-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : ownerMintEvents && ownerMintEvents.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Amount</th>
                  <th>Date & Time</th>
                  <th>Block Number</th>
                  <th>Transaction Hash</th>
                </tr>
              </thead>
              <tbody>
                {ownerMintEvents.map((event, index) => {
                  const recipientAddress = (event.args as any)?.to || (event.args as any)?.[0];
                  const amount = (event.args as any)?.amount || (event.args as any)?.[1];
                  const blockExplorerTxLink = getBlockExplorerTxLink(targetNetwork.id, event.log.transactionHash || "");
                  const timestamp = (event as any)?.blockData?.timestamp;
                  const formattedDateTime = timestamp ? new Date(Number(timestamp) * 1000).toLocaleString() : "Unknown";

                  return (
                    <tr key={index}>
                      <td>{recipientAddress ? <Address address={recipientAddress} size="sm" /> : "Unknown"}</td>
                      <td>{amount ? formatEther(amount) : "0"} BGBRD</td>
                      <td>{formattedDateTime}</td>
                      <td>{event.log.blockNumber?.toString() ?? "Unknown"}</td>
                      <td className="font-mono">
                        {event.log.transactionHash && blockExplorerTxLink ? (
                          <a
                            href={blockExplorerTxLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600 underline"
                          >
                            {event.log.transactionHash.slice(0, 8)}...{event.log.transactionHash.slice(-6)}
                          </a>
                        ) : (
                          "Unknown"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xl">No owner mint events found</p>
          </div>
        )}
      </div>

      {/* Batch Mint Events */}
      <div className="w-full mb-12">
        <h2 className="text-2xl font-bold mb-4 text-green-500">Batch Mint Events</h2>
        {isBatchMintLoading ? (
          <div className="flex justify-center items-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : batchMintEvents && batchMintEvents.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Date & Time</th>
                  <th>Block Number</th>
                  <th>Transaction Hash</th>
                </tr>
              </thead>
              <tbody>
                {batchMintEvents.map((event, index) => {
                  const userAddress = (event.args as any)?.user || (event.args as any)?.[0];
                  const amount = (event.args as any)?.amount || (event.args as any)?.[1];
                  const blockExplorerTxLink = getBlockExplorerTxLink(targetNetwork.id, event.log.transactionHash || "");
                  const timestamp = (event as any)?.blockData?.timestamp;
                  const formattedDateTime = timestamp ? new Date(Number(timestamp) * 1000).toLocaleString() : "Unknown";

                  return (
                    <tr key={index}>
                      <td>{userAddress ? <Address address={userAddress} size="sm" /> : "Unknown"}</td>
                      <td>{amount ? formatEther(amount) : "0"} BGBRD</td>
                      <td>{formattedDateTime}</td>
                      <td>{event.log.blockNumber?.toString() ?? "Unknown"}</td>
                      <td className="font-mono">
                        {event.log.transactionHash && blockExplorerTxLink ? (
                          <a
                            href={blockExplorerTxLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600 underline"
                          >
                            {event.log.transactionHash.slice(0, 8)}...{event.log.transactionHash.slice(-6)}
                          </a>
                        ) : (
                          "Unknown"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xl">No batch mint events found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsPage;
