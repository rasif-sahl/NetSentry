export const familyConsent = {
  accepted: true,
  disclosureVersion: "family-sharing-v1",
};
export function FamilyConsent() {
  return (
    <label className="check">
      <input type="checkbox" required />I accept the family-sharing disclosure
      and have authority for this change.
    </label>
  );
}
