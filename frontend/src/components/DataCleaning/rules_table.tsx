import { FC, useState } from "react";
import { Rule } from "../../types/DataCleaning/shared";
import CreateRuleModal from "./rule_modal";

interface RulesTableProps {
  rules: Rule[];
  addRule: (rule:Rule) => void;
  deleteRule: (ruleId: number | null, deleteAll?: boolean) => void;
}

const RulesTable: FC<RulesTableProps> = ({ rules, addRule, deleteRule }) => {
  return(
    <div className="w-full max-h-[450px] p-4 bg-white border-gray-300">
      {/* Action Buttons
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={addRule}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Create Rule
        </button>
        <button
          onClick={() => deleteRule(null, true)} // Delete all rules
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Delete All Rules
        </button>
      </div> */}
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 rounded">
          <thead>
            <tr className="bg-gray-200 text-gray-600 text-sm uppercase">
              <th className="py-2 px-4">Step</th>
              <th className="py-2 px-4">Fields</th>
              <th className="py-2 px-4">Words</th>
              <th className="py-2 px-4">POS</th>
              <th className="py-2 px-4">Action</th>
              <th className="py-2 px-4">Remove</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="text-gray-700">
                <td className="py-2 px-4">{rule.step}</td>
                <td className="py-2 px-4">{rule.fields}</td>
                <td className="py-2 px-4">{rule.words}</td>
                <td className="py-2 px-4">{rule.pos}</td>
                <td className="py-2 px-4">{rule.action}</td>
                <td className="py-2 px-4">
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RulesTable;
