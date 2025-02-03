import React, { FC, useState } from 'react';
import { Rule } from '../../types/DataCleaning/shared';

interface RulesTableProps {
    rules: Rule[];
    addRule: (rule: Rule) => Promise<void>;
    deleteRule: (ruleId: number | null, deleteAll?: boolean) => Promise<void>;
    reorderRules: (updatedRules: Rule[]) => Promise<void>;
}

const RulesTable: FC<RulesTableProps> = ({ rules, deleteRule, reorderRules }) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDrop = (targetIndex: number) => {
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const updatedRules = [...rules];
        const [draggedRule] = updatedRules.splice(draggedIndex, 1);
        updatedRules.splice(targetIndex, 0, draggedRule);

        reorderRules(updatedRules);
        setDraggedIndex(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <div className="w-full h-[448px] py-4 bg-white border-gray-300">
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
                        {rules.map((rule, index) => (
                            <tr
                                key={rule.id}
                                className="text-gray-700"
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(index)}>
                                <td className="py-2 px-4">{rule.step}</td>
                                <td className="py-2 px-4">{rule.fields}</td>
                                <td className="py-2 px-4">{rule.words}</td>
                                <td className="py-2 px-4">{rule.pos}</td>
                                <td className="py-2 px-4">{rule.action}</td>
                                <td className="py-2 px-4">
                                    <button
                                        onClick={() => deleteRule(rule.id)}
                                        className="bg-red-500 text-white px-2 py-1 rounded">
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
