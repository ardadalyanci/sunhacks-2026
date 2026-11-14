// App icon (browser tab, Android home screen, PWA install): Sol on the morning sky.
import { ImageResponse } from "next/og";
import { mascotDataUri } from "@/components/mascot-svg";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
        <img src={mascotDataUri()} width={430} height={430} alt="" />
      </div>
    ),
    size,
  );
}
