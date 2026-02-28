import { DashboardLayout } from "@/components/DashboardLayout";
import { ResellerManagement } from "@/components/settings/ResellerManagement";
import { ResellerDashboardStats } from "@/components/reseller/ResellerDashboardStats";

export default function Resellers() {
  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Resellers / Sub-Dealers</h1>
        <p className="page-description">Manage resellers, commissions, and customer assignments</p>
      </div>
      <ResellerDashboardStats />
      <ResellerManagement />
    </DashboardLayout>
  );
}
