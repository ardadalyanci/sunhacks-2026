// iPhone home-screen icon ("Add to Home Screen" in Safari). iOS rounds the corners itself.
import { ImageResponse } from "next/og";
import { mascotDataUri } from "@/components/mascot-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#dcebff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
        <img src={mascotDataUri()} width={150} height={150} alt="" />
      </div>
    ),
    size,
  );
}
