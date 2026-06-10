import React from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { createApplication } from '../api/application';

interface CreateApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateApplicationModal: React.FC<CreateApplicationModalProps> = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await createApplication({
        ...values,
        lease_start_date: values.lease_start_date.format('YYYY-MM-DD'),
        lease_end_date: values.lease_end_date.format('YYYY-MM-DD'),
      });
      message.success('创建成功');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message !== 'Validation failed') {
        message.error(err.message || '创建失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="新建租约申请"
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
          <DatePicker style={{ width: '100%' }} disabledDate={(current) => {
            const startDate = form.getFieldValue('lease_start_date');
            return current && startDate && current < dayjs(startDate).add(1, 'day');
          }} />
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

export default CreateApplicationModal;
