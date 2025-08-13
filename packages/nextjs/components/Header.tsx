"use client";

import Image from "next/image";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

/**
 * Site header
 */
export const Header = () => {
  return (
    <header className="container mx-auto border-l border-r border-black">
      <div className="container z-10 p-6 lg:p-8 flex justify-between items-center">
        <div className="w-40 md:w-[260px]" style={{ aspectRatio: "260/78" }}>
          <Image
            className="w-full h-full object-contain"
            src="bg-bread-logo.svg"
            alt="logo"
            width={260}
            height={78}
            style={{ aspectRatio: "260/78" }}
          />
        </div>
        <div>
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    </header>
  );
};
