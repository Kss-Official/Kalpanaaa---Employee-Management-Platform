import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Barcode from 'react-barcode';
import { Printer, ArrowLeft } from 'lucide-react';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';

export const AllEmployeeBarcodesView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { employees } = useAuth();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white min-h-screen text-black p-8 relative">
      <div className="print:hidden flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-black font-semibold cursor-pointer">
          <ArrowLeft className="w-5 h-5" /> Back to Directory
        </button>
        <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-bold cursor-pointer shadow-lg">
          <Printer className="w-5 h-5" /> Print All Barcodes
        </button>
      </div>

      <div className="text-center print:block hidden mb-8">
        <h1 className="text-2xl font-bold">Kalpanaaa Software Solutions</h1>
        <p className="text-slate-600">Employee Master Barcode List</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-4">
        {employees.map(emp => (
          <div key={emp.id} className="border-2 border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center break-inside-avoid text-center">
            <img src={kalpanaLogo} alt="Logo" className="w-10 h-10 object-contain mb-2" />
            <h3 className="font-bold text-base text-slate-900 leading-tight mb-1">{emp.fullName}</h3>
            <p className="text-xs text-slate-600 mb-3 truncate w-full">{emp.designation}</p>
            <div className="bg-white p-2 pb-4 rounded-lg overflow-visible w-full flex justify-center">
              <Barcode 
                value={emp.employeeId} 
                width={1.5} 
                height={50} 
                fontSize={16} 
                background="transparent"
                margin={5}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
