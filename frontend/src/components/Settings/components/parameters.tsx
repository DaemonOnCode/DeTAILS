import React, { FC, useCallback, useEffect, useState } from 'react';
import { debounce } from 'lodash';
import { AIParametersProps } from '../../../types/Settings/props';

const AIParameters: FC<AIParametersProps> = ({
    temperature,
    randomSeed,
    cutoff,
    onTemperatureChange,
    onRandomSeedChange,
    onCutoffChange
}) => {
    const [localTemperature, setLocalTemperature] = useState(temperature);
    const [localCutoffTime, setLocalCutoffTime] = useState(cutoff);

    useEffect(() => {
        setLocalTemperature(temperature);
    }, [temperature]);

    useEffect(() => {
        setLocalCutoffTime(cutoff);
    }, [cutoff]);

    const debouncedUpdateTemperature = useCallback(
        debounce((newTemperature: number) => {
            onTemperatureChange(newTemperature);
        }, 300),
        [onTemperatureChange]
    );

    const debouncedUpdateCutoffTime = useCallback(
        debounce((newCutoffTime: number) => {
            onCutoffChange(newCutoffTime);
        }, 300),
        [onCutoffChange]
    );

    const handleCutoffTimeChangeInternal = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newCutoffTime = parseInt(e.target.value, 10);
        setLocalCutoffTime(newCutoffTime);
        debouncedUpdateCutoffTime(newCutoffTime);
    };

    const handleTemperatureChangeInternal = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTemperature = parseFloat(e.target.value);
        setLocalTemperature(newTemperature);
        debouncedUpdateTemperature(newTemperature);
    };

    return (
        <div className="my-4">
            <div className="flex justify-between items-center">
                <label className="font-medium">Temperature</label>
                <span>{temperature.toFixed(2)}</span>
            </div>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localTemperature}
                onChange={handleTemperatureChangeInternal}
                className="w-full mt-1 custom-range"
            />
            <div className="mt-4">
                <label className="block font-medium">Random Seed:</label>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={randomSeed}
                    onChange={(e) => onRandomSeedChange(parseInt(e.target.value) || 0)}
                    className="mt-1 border rounded p-2 w-24"
                />
            </div>
            <div className="mt-4">
                <div className="flex justify-between items-center">
                    <label className="font-medium">Cutoff Time (minutes)</label>
                    <span>{(cutoff / 60).toFixed(1)}</span>
                </div>
                <input
                    type="range"
                    min="60"
                    max="600"
                    step="60"
                    value={localCutoffTime}
                    onChange={handleCutoffTimeChangeInternal}
                    className="w-full mt-1 custom-range"
                />
            </div>
        </div>
    );
};

export default AIParameters;
