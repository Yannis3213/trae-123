import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { updateApplication } from '../api/application';
import type { Application } from '../types';

interface EditApplicationModalProps {
  open: boolean;
  record: Application | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditApplicationModal: React.FC<EditApplicationModalProps> = ({ open, record, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (open && record) {
      form.setFieldsValue({
        tenant_name: record.tenant_name,
        tenant_phone: record.tenant_phone,
        room_number: record.room_number,
        building_name: record.building_name,
        lease_start_date: dayjs(record.lease_start_date),
        lease_end_date: dayjs(record.lease_end_date),
        monthly_rent: record.monthly_rent,
        deposit: record.deposit,
      });
    }
  }, [open, record, form]);

  const handleSubmit = async () => {
    if (!record) return;
    try {
      const values = await form.validateFields();
      setLoading(true);
      await updateApplication(record.id, {
        ...values,
        lease_start_date: values.lease_start_date.format('YYYY-MM-DD'),
        lease_end_date: values.lease_end_date.format('YYYY-MM-DD'),
        version: record.version,
      });
      message.success('编辑成功');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message !== 'Validation failed') {
        message.error(err.message || '编辑失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="编辑租约申请"
      open={open}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="tenant_name" label="租客姓名" rules={[{ required: true, message: '请输入租客姓名' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="tenant_phone" label="租客电话" rules={[{ required: true, message: '请输入租客电话' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="room_number" label="房间号" rules={[{ required: true, message: '请输入房间号' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="building_name" label="楼栋名称" rules={[{ required: true, message: '请输入楼栋名称' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="lease_start_date" label="签约开始日期" rules={[{ required: true, message: '请选择签约开始日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="lease_end_date" label="签约结束日期" rules={[{ required: true, message: '请选择签约结束日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="monthly_rent" label="月租金" rules={[{ required: true, message: '请输入月租金' }]}>
          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="deposit" label="押金" rules={[{ required: true, message: '请输入押金' }]}>
          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditApplicationModal;
