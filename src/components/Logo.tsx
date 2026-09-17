import Image from "next/image";

export function Logo({ size = 48, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/logo.jpg"
        alt="TUTOLOOP"
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, objectPosition: "50% 20%" }}
        priority
      />
      {withText && (
        <span className="text-lg font-bold tracking-wide">
          <span className="text-blue">TUTO</span>
          <span className="text-green">LOOP</span>
        </span>
      )}
    </div>
  );
}
