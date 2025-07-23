import { OwnerContracts } from "./_components/OwnerContracts";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Owner Functions",
  description: "Manage your deployed contracts with owner-only functions",
});

const Owner: NextPage = () => {
  return (
    <>
      <OwnerContracts />
      <div className="text-center mt-8 bg-secondary p-10">
        <h1 className="text-4xl my-0">Owner Functions</h1>
        <p className="text-neutral">
          Manage your deployed contracts with owner-only functions.
          <br /> Only the contract owner can access these functions.
        </p>
      </div>
    </>
  );
};

export default Owner;
