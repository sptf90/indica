import Image from "next/image";

export default function RequestPhoto({ src, thumbnail = false }) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt="Foto anexada ao pedido"
      width={thumbnail ? 112 : 640}
      height={thumbnail ? 96 : 480}
      className={thumbnail ? "request-photo request-photo--thumbnail" : "request-photo"}
      referrerPolicy="no-referrer"
      unoptimized
    />
  );
}
