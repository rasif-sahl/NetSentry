import Image from "next/image";
import Link from "next/link";

function LoadingStatus({ message }: { message: string }) {
  return (
    <div className="p-6 text-sm leading-relaxed text-primary" role="status">
      {message}
    </div>
  );
}

export function Loading() {
  return <LoadingStatus message="Loading your workspace…" />;
}

function Wordmark() {
  return (
    <Image
      src="/brand/netsentry-logo.svg"
      alt="NetSentry"
      width={223}
      height={64}
      className="h-auto w-40"
    />
  );
}

export function PageLoading() {
  return (
    <main className="grid min-h-dvh place-content-center justify-items-center bg-background text-center text-primary">
      <Link href="/">
        <Wordmark />
      </Link>
      <Loading />
    </main>
  );
}

export function PublicLoading() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[84px] bottom-0 z-20 grid place-content-center justify-items-center bg-background text-center text-primary">
      <span className="scheme-light">
        <Wordmark />
      </span>
      <LoadingStatus message="Loading…" />
    </div>
  );
}
