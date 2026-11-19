export const networkConsent = {
  accepted: true,
  disclosureVersion: "network-sharing-v1",
};
export function NetworkConsent() {
  return (
    <label className="check">
      <input type="checkbox" required />I have permission to monitor this
      network and accept the network-sharing disclosure.
    </label>
  );
}
