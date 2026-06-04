import { useEffect, useState } from "react";
import { api } from "../lib/api";

export const useFetch = <Data extends any = any>(url: string) => {
  const [data, setData] = useState<Data>();
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTimeout(() => {
      api
        .get<Data>(url)
        .then((data) => {
          setData(data);
          setIsLoading(false);
          setIsError(false);
          setError(null);
        })
        .catch((err) => {
          setData(undefined);
          setIsLoading(false);
          setIsError(true);
          setError(err);
        });
    }, 1000);
  }, [url]);

  return { data, isLoading, isError, error };
};
