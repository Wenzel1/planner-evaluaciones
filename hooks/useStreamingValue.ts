"use client";

import { useEffect, useRef, useState } from "react";

export default function useStreamingValue(
    value: string,
    speed = 10
) {
    const [displayValue, setDisplayValue] = useState(value);

    const indexRef = useRef(0);

    useEffect(() => {

        indexRef.current = 0;

        setDisplayValue("");

        if (!value) return;

        const interval = setInterval(() => {

            indexRef.current++;

            setDisplayValue(value.slice(0, indexRef.current));

            if (indexRef.current >= value.length) {
                clearInterval(interval);
            }

        }, speed);

        return () => clearInterval(interval);

    }, [value, speed]);

    return displayValue;
}