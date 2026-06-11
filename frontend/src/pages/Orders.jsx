import React, { useState } from 'react'
import { Button, Space, Modal, Form, Input, DatePicker, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import Layout from '../components/Layout.jsx'
import OrderList from '../components/OrderList.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { orderApi } from '../api.js'
import { ROLE_KEYS } from '../utils/constants.js'

const { TextArea } = Input

const CAN_CREATE_ROLES = [
  ROLE_KEYS.PROJECT_ASSISTANT,
  ROLE_KEYS.DELIVERY_REGISTRAR,
  ROLE_KEYS.DELIVERY_MANAGER
]

export default function Orders() {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [createLoading, setCreateLoading] = useState(false)

  const canCreate = user && CAN_CREATE_ROLES.includes(user.role)

  const handleCreateOrder = async (values) => {
    setCreateLoading(true)
    try {
      const payload = {
        title: values.title,
        project_name: values.project_name,
        requirement_confirmation_clue: values.requirement_confirmation_clue
      }
      if (values.requirement_deadline) {
        payload.requirement_deadline = values.requirement_deadline.format('YYYY-MM-DD')
      }
      if (values.schedule_deadline) {
        payload.schedule_deadline = values.schedule_deadline.format('YYYY-MM-DD')
      }
      if (values.delivery_deadline) {
        payload.delivery_deadline = values.delivery_deadline.format('YYYY-MM-DD')
      }
      await orderApi.create(payload)
      message.success('建单成功')
      setCreateModalOpen(false)
      createForm.resetFields()
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      message.error('建单失败：' + (err.response?.data?.detail || err.message || '未知错误'))
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <Layout>
      <div className="page-container">
        <div className="page-title" style={{ marginBottom: 16 }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <span>订单管理</span>
            {canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
                新建需求交付单
              </Button>
            )}
          </Space>
        </div>
        <OrderList key={`${user?.id || 'guest'}-${refreshKey}`} onRefresh={refreshKey} />
      </div>

      <Modal
        title="新建需求交付单"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateOrder}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入订单标题' }]}
          >
            <Input placeholder="请输入订单标题" />
          </Form.Item>
          <Form.Item
            name="project_name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item
            name="requirement_confirmation_clue"
            label="需求确认线索"
            rules={[{ required: true, message: '请输入需求确认线索' }]}
          >
            <Input placeholder="请输入需求确认线索" />
          </Form.Item>
          <Form.Item
            name="requirement_deadline"
            label="需求确认截止日"
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="schedule_deadline"
            label="排期评估截止日"
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="delivery_deadline"
            label="交付验收截止日"
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                提交
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
