import request from './interceptor'

export function getMedicationRemindersApi(idCard) {
  return request({
    url: `/medication/${idCard}`,
    method: 'get'
  })
}

export function createMedicationReminderApi(data) {
  return request({
    url: '/medication',
    method: 'post',
    data
  })
}

export function updateMedicationReminderApi(id, data) {
  return request({
    url: `/medication/${id}`,
    method: 'put',
    data
  })
}

export function deleteMedicationReminderApi(id) {
  return request({
    url: `/medication/${id}`,
    method: 'delete'
  })
}
