import React, { useState } from "react";
import { Rule } from "../../types/DataCleaning/shared";

interface CreateRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Rule) => void;
}

const CreateRuleModal: React.FC<CreateRuleModalProps> = ({ isOpen, onClose, onSave }) => {
  const [field, setField] = useState('<ANY>');
  const [word, setWord] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [action, setAction] = useState('Remove');
  const [advancedFilters, setAdvancedFilters] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const validateForm = () => {
    const validationErrors: string[] = [];
    if (word.trim() === "") validationErrors.push("Word is required.");
    if (action.trim() === "") validationErrors.push("Action is required.");
    return validationErrors;
  };

  const handleSave = () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const rule = {
      id: -1, // Temporary ID, replace with backend-generated ID
      step: 1,
      fields: field,
      words: word,
      pos: partOfSpeech,
      action,
    };

    onSave(rule);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Create Rule</h2>

        {errors.length > 0 && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 rounded px-4 py-3">
            <ul>
              {errors.map((error, index) => (
                <li key={index}>- {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Field Dropdown */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Field</label>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="<ANY>">&lt;ANY&gt;</option>
            <option value="title">Title</option>
            <option value="selftext">Body</option>
          </select>
        </div>

        {/* Word Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Word</label>
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Enter word"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {/* Part-of-Speech Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Part-of-Speech</label>
          <input
            type="text"
            value={partOfSpeech}
            onChange={(e) => setPartOfSpeech(e.target.value)}
            placeholder="Enter POS tag"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {/* Action Dropdown */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="Remove">Remove</option>
            <option value="Include">Include</option>
          </select>
        </div>

        {/* Advanced Filters Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Advanced Filters</label>
          <input
            type="text"
            value={advancedFilters}
            onChange={(e) => setAdvancedFilters(e.target.value)}
            placeholder="Enter advanced filters"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-sm text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-sm text-white rounded hover:bg-blue-700"
          >
            Create Rule
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRuleModal;
