import { captureException } from "@/src/monitoring/sentry";
import axios from "axios";
import apiClient from "./apiClient";

export type Payslip = {
  employee?: string;
  payment_date?: string;
  period_start_date?: string;
  period_end_date?: string;
  company?: string;
  gross_amount?: string;
  gross_amount_currency?: string;
  net_amount?: string;
  net_amount_currency?: string;
  payslip_file?: string;
  payslip_file_url?: string;
};

export type PayslipResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: Payslip[];
};

export async function getPayslips(
  page = 1,
  pageSize = 10,
): Promise<PayslipResponse> {
  try {
    const res = await apiClient.get<PayslipResponse>(
      "/mobile/api/employee/payslip/",
      {
        params: { page, page_size: pageSize },
      },
    );
    return res.data ?? {};
  } catch (error) {
    captureException(error, {
      scope: "payslip_service",
      action: "get_payslips",
      extras: { page, pageSize },
    });
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        status ? `Request failed with status ${status}` : "Request failed",
      );
    }
    throw error;
  }
}

export default { getPayslips };
