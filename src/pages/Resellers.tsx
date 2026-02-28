import { DashboardLayout } from "@/components/DashboardLayout";
import { ResellerManagement } from "@/components/settings/ResellerManagement";

export default function Resellers() {
  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Resellers / Sub-Dealers</h1>
        <p className="page-description">Manage resellers, commissions, and customer assignments</p>
      </div>
      <ResellerManagement />
    </DashboardLayout>
  );
}
