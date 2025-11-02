import { useEffect, useState } from "react";

interface Props {
  initialValue?: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export default function NameDialog({ initialValue = "", onSave, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 text-black shadow-2xl">
        <div className="text-lg font-bold mb-2">Choose a public screen name</div>
        <p className="text-sm text-black/70 mb-3">
          This name will be public on leaderboards. Don’t include personal info. You can change it
          anytime.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. SpeedySam"
          maxLength={15}
          className="w-full rounded-lg border border-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md bg-black/10 hover:bg-black/15"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(value)}
            className="px-3 py-1.5 rounded-md bg-gradient-to-r from-fuchsia-600 via-purple-600 to-sky-600 text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
