"use client";

import { useEffect, useState } from "react";
import useStreamingValue from "@/hooks/useStreamingValue";

interface Props {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    rows?: number;
}

export default function StreamTextarea({

    value,

    onChange,

    placeholder,

    className,

    rows = 8

}: Props) {

    const [userEditing, setUserEditing] = useState(false);

    const streamedValue = useStreamingValue(value);

    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {

        if (!userEditing) {

            setDisplayValue(streamedValue);

        }

    }, [streamedValue, userEditing]);

    return (

        <textarea

            rows={rows}

            className={className}

            placeholder={placeholder}

            value={userEditing ? displayValue : streamedValue}

            onFocus={() => {

                setUserEditing(true);

                setDisplayValue(streamedValue);

            }}

            onBlur={() => {

                setUserEditing(false);

            }}

            onChange={(e) => {

                setDisplayValue(e.target.value);

                onChange(e.target.value);

            }}

        />

    );

}