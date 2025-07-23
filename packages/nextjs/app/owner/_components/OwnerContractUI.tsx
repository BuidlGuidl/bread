"use client";

// @refresh reset
import { useReducer } from "react";
import { OwnerWriteMethods } from "./OwnerWriteMethods";
import { useAccount } from "wagmi";
import { ContractVariables } from "~~/app/debug/_components/contract/ContractVariables";
import { Address, Balance } from "~~/components/scaffold-eth";
import { useNetworkColor, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { ContractName } from "~~/utils/scaffold-eth/contract";
import { getAllContracts } from "~~/utils/scaffold-eth/contractsData";

type OwnerContractUIProps = {
  contractName: ContractName;
  className?: string;
};

/**
 * UI component to interface with deployed contracts - Owner functions only.
 **/
export const OwnerContractUI = ({ contractName, className = "" }: OwnerContractUIProps) => {
  const [refreshDisplayVariables, triggerRefreshDisplayVariables] = useReducer(value => !value, false);
  const { targetNetwork } = useTargetNetwork();
  const networkColor = useNetworkColor();
  const { address: connectedAddress } = useAccount();

  // Get contract data directly like the main page does
  const contractsData = getAllContracts();
  const deployedContractData = contractsData[contractName] as any;

  // Read the contract owner
  const { data: contractOwner } = useScaffoldReadContract({
    contractName,
    functionName: "owner",
  });

  if (!deployedContractData) {
    return (
      <p className="text-3xl mt-14">
        {`No contract found by the name of "${contractName}" on chain "${targetNetwork.name}"!`}
      </p>
    );
  }

  // Check if user is connected and is the owner
  if (!connectedAddress) {
    return (
      <div className="text-center mt-14">
        <p className="text-2xl mb-4">🔐 Owner Access Required</p>
        <p className="text-lg">Please connect your wallet to access owner functions.</p>
      </div>
    );
  }

  if (contractOwner && connectedAddress.toLowerCase() !== contractOwner.toLowerCase()) {
    return (
      <div className="text-center mt-14">
        <p className="text-2xl mb-4">🚫 Access Denied</p>
        <p className="text-lg mb-2">Only the contract owner can access this page.</p>
        <div className="bg-base-200 p-4 rounded-lg inline-block">
          <p className="text-sm mb-2">
            <strong>Contract Owner:</strong>
          </p>
          <Address address={contractOwner} />
          <p className="text-sm mt-2 mb-2">
            <strong>Your Address:</strong>
          </p>
          <Address address={connectedAddress} />
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-6 px-6 lg:px-10 lg:gap-12 w-full max-w-7xl my-0 ${className}`}>
      <div className="col-span-5 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <div className="col-span-1 flex flex-col">
          <div className="bg-base-100 border-base-300 border shadow-md shadow-secondary rounded-3xl px-6 lg:px-8 mb-6 space-y-1 py-4">
            <div className="flex">
              <div className="flex flex-col gap-1">
                <span className="font-bold">{contractName}</span>
                <Address address={deployedContractData.address} />
                <div className="flex gap-1 items-center">
                  <span className="font-bold text-sm">Balance:</span>
                  <Balance address={deployedContractData.address} className="px-0 h-1.5 min-h-[0.375rem]" />
                </div>
              </div>
            </div>
            {targetNetwork && (
              <p className="my-0 text-sm">
                <span className="font-bold">Network</span>:{" "}
                <span style={{ color: networkColor }}>{targetNetwork.name}</span>
              </p>
            )}
          </div>
          <div className="bg-base-300 rounded-3xl px-6 lg:px-8 py-4 shadow-lg shadow-base-300">
            <ContractVariables
              refreshDisplayVariables={refreshDisplayVariables}
              deployedContractData={deployedContractData}
            />
          </div>
        </div>
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          <div className="z-10">
            <div className="bg-base-100 rounded-3xl shadow-md shadow-secondary border border-base-300 flex flex-col mt-10 relative">
              <div className="h-[5rem] w-[5.5rem] bg-base-300 absolute self-start rounded-[22px] -top-[38px] -left-[1px] -z-10 py-[0.65rem] shadow-lg shadow-base-300">
                <div className="flex items-center justify-center space-x-2">
                  <p className="my-0 text-sm">Owner</p>
                </div>
              </div>
              <div className="p-5 divide-y divide-base-300">
                <OwnerWriteMethods
                  deployedContractData={deployedContractData}
                  onChange={triggerRefreshDisplayVariables}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
