# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import xlsxwriter

import tempfile

VAL_MISSED = -5

def export_scores(heat, judge_ids, scores_by_surfer, average_scores, n_best_waves, filename): # TODO: heat data
    heat_id = int(heat.id)

    id2color = {p.surfer_id: p.lycra_color.name for p in heat.participations}

    # compile average scores in a from the exporters can handle
    average_scores_export = {}
    for sid, scores in average_scores.items():
        for score in scores:
            average_scores_export.setdefault(score['surfer_id'], {})[score['wave']] = score['score']

    # compile scores in a form, the exporters can handle
    scores_by_surfer_wave_judge = {}
    for sid, waves in scores_by_surfer.items():
        for wave, scores in waves.items():
            for score in scores:
                scores_by_surfer_wave_judge.setdefault(score.surfer_id, {}).setdefault(score.wave, {})[score.judge_id] = score


    best_scores_average = compute_best_waves(average_scores_export, n_best_waves)
    sorted_total_scores = compute_places_total_scores(average_scores_export, n_best_waves)
    all_scores, best_scores_by_judge = compute_by_judge_scores(scores_by_surfer_wave_judge, n_best_waves)

    export_data = _collect_export_data(all_scores,
                                       average_scores_export,
                                       best_scores_by_judge,
                                       best_scores_average,
                                       sorted_total_scores,
                                       heat,
                                       id2color,
                                       n_best_waves)


    write_xlsx(filename, export_data)
    return filename
    # directory = 'exports'
    # if not os.path.exists(directory):
        # os.makedirs(directory)

    # filename = None
    # if mode == 'judge_sheet':
    #     filename = u'export_{}_heat_sheet.csv'.format(heat_name)
    # elif mode == 'best_waves':
    #     filename = u'export_{}_best_judge_waves.csv'.format(heat_name)
    # elif mode == 'averaged_scores':
    #     filename = u'export_{}_best_average_waves.csv'.format(heat_name)
    #
    # if filename is not None:
    #     utils.write_csv(os.path.join(directory, filename), export_data[mode]['data'], export_data[mode]['header'])

    # filename = os.path.abspath(os.path.join(directory, u'Auswertung_{}.xlsx'.format(heat_name)))
    # utils.write_xlsx(filename, export_data)
    # from cherrypy.lib.static import serve_file
    # return serve_file(filename, "application/x-download", "attachment")



def compute_places_total_scores(average_scores, n_best_waves):
    total_scores = {}
    for surfer_id, data in average_scores.items():
        sorted_scores = sorted(data.values(), reverse=True)
        sorted_scores = [s for s in sorted_scores if s >= 0]
        total_scores[surfer_id] = sum(sorted_scores[:n_best_waves])
    s = sorted(total_scores.items(), key=lambda x: x[1], reverse=True)
    sorted_total_scores = {}
    for idx, (surfer_id, score) in enumerate(s):
        sorted_total_scores[surfer_id] = (idx, score)
    return sorted_total_scores


def compute_best_waves(average_scores, n_best_waves):
    best_scores_average = {}
    for surfer_id, data in average_scores.items():
        sorted_scores = sorted(data.items(), key=lambda x: x[1], reverse=True)
        sorted_scores = [s for s in sorted_scores if s[1] >= 0]
        best_scores_average[surfer_id] = sorted_scores[:n_best_waves]
    return best_scores_average


def compute_by_judge_scores(scores_by_surfer_wave, n_best_waves):
    best_scores_by_judge = {}
    all_scores = {}
    for surfer_id, data in scores_by_surfer_wave.items():

        judge_vals = {}
        for wave_idx, scores in data.items():
            for judge_id, score in scores.items():
                judge_vals.setdefault(judge_id, []).append( (wave_idx, score.score)  )

        for judge_id, vals in judge_vals.items():
            best_scores_by_judge.setdefault(surfer_id, {})[judge_id] = sorted(vals, key=lambda x: x[1], reverse=True)[:n_best_waves]
            all_scores.setdefault(surfer_id, {})[judge_id] = sorted(vals, key=lambda x: x[0])

    return all_scores, best_scores_by_judge


def _collect_export_data(all_scores, average_scores, best_scores_by_judge, best_scores_average, sorted_total_scores, heat_info, id2color, n_best_waves):
    export_data = {}


    # *****************
    # export heat sheet
    # *****************
    csv_out_data = []
    labels_scores = ['Wave {}'.format(i+1) for i in range(heat_info.number_of_waves)]
    header = ['Name', 'Color', 'Judge Id'] + labels_scores
    highlights = {}
    for idx, participation in enumerate(heat_info.participations):
        surfer_id = participation.surfer_id
        data = all_scores.get(surfer_id, {})
        for judge in heat_info.judges:
            judge_id = judge.id
            vals = data.get(judge_id, [])
            res = {}
            res['Judge Id'] = judge_id
            res['Color'] = id2color.get(surfer_id, 'Error: Color not found')
            if len(vals) > 0:
                indices, scores = zip(*vals)
            else:
                indices = [None] * n_best_waves
                scores = [None] * n_best_waves
            best_waves = list(zip(*best_scores_by_judge.get(surfer_id, {}).get(judge_id, [])))
            for label_score, wave_idx, score in zip(labels_scores, indices, scores):
                res[label_score] = score
                if len(best_waves) > 0 and wave_idx in best_waves[0]:
                    highlights.setdefault(res['Color'], {}).setdefault(judge_id, []).append( labels_scores[wave_idx] )

            res['Name'] = u'{} {}'.format(participation.surfer.first_name, participation.surfer.last_name)
            csv_out_data.append(res)
    export_data.setdefault('judge_sheet', {})['title_line'] = u'{} {} {}'.format(heat_info.category.tournament.name, heat_info.category.name, heat_info.name)
    export_data.setdefault('judge_sheet', {})['header'] = header
    export_data['judge_sheet']['data'] = csv_out_data
    export_data['judge_sheet']['highlights'] = highlights


    # *****************
    # export best waves per judge
    # *****************
    base_data = best_scores_by_judge

    csv_out_data = []
    labels_scores = ['Wave {} (score)'.format(i+1) for i in range(n_best_waves)]
    labels_index = ['Wave {} (number)'.format(i+1) for i in range(n_best_waves)]
    header = ['Name', 'Color', 'Judge Id'] + labels_scores + labels_index
    for idx, participation in enumerate(heat_info.participations):
        surfer_id = participation.surfer_id
        data = base_data.get(surfer_id, {})
        for judge in heat_info.judges:
            judge_id = judge.id
            vals = data.get(judge_id, [])
            res = {}
            res['Judge Id'] = judge_id
            res['Color'] = id2color.get(surfer_id, 'Error: Color not found')
            if len(vals) > 0:
                indices, scores = zip(*vals)
            else:
                indices = [None] * n_best_waves
                scores = [None] * n_best_waves
            for label_index, label_score, index, score in zip(labels_index, labels_scores, indices, scores):
                res[label_score] = '' if score is None else '{:.2f}'.format(score)
                res[label_index] = '' if index is None else index + 1
            res['Name'] = u'{} {}'.format(participation.surfer.first_name, participation.surfer.last_name)
            csv_out_data.append(res)

    export_data.setdefault('best_waves', {})['header'] = header
    export_data['best_waves']['title_line'] = u'{} {} {}'.format(heat_info.category.tournament.name, heat_info.category.name, heat_info.name)
    export_data['best_waves']['data'] = csv_out_data


    # *****************
    # export averaged scores
    # *****************
    base_data = best_scores_average

    csv_out_data = []
    all_scores_label_tpl = 'Wave {}'
    labels_scores = ['{}. Best Wave'.format(i+1) for i in range(n_best_waves)]
    header = ['Ranking', 'Name', 'Color', 'Total Score'] + labels_scores + ['']
    for idx, participation in enumerate(heat_info.participations):
        surfer_id = participation.surfer_id
        vals = base_data.get(surfer_id, [])
        res = {}
        res['Color'] = id2color.get(surfer_id, 'Error: Color not found')
        if len(vals) > 0:
            _, scores = zip(*vals)
            total_score = sum(scores)
        else:
            scores = [None] * n_best_waves
            total_score = 0.0
        for label_score, score in zip(labels_scores, scores):
            res[label_score] = '' if score is None else '{:.2f}'.format(score)
        ranking, total_score = sorted_total_scores.get(surfer_id, (len(heat_info.participations) - 1, total_score) )

        # quick and dirty implementation for all averaged scores (not only best and second best)
        for wave in sorted(average_scores.get(surfer_id, {}).keys()):
            label = all_scores_label_tpl.format(wave + 1)
            res[label] = average_scores[surfer_id][wave]
            if label not in header:
                header.append(label)

        res['Name'] = u'{} {}'.format(participation.surfer.first_name, participation.surfer.last_name)
        res['Ranking'] = ranking
        res['Total Score'] = total_score
        csv_out_data.append( res )
    csv_out_data = sorted(csv_out_data, key=lambda res: res.get('Ranking'))

    export_data.setdefault('averaged_scores', {})['header'] = header
    export_data['averaged_scores']['title_line'] = u'{} {} {}'.format(heat_info.category.tournament.name, heat_info.category.name, heat_info.name)
    export_data['averaged_scores']['data'] = csv_out_data

    return export_data

def write_xlsx(filename, data):
    workbook = xlsxwriter.Workbook(filename)

    # TEXT blau
    formats = {
        'text': workbook.add_format({'align': 'right', 'num_format': '#,##0.00', 'font_color': 'blue'}),
        'number': workbook.add_format({'num_format': '#,##0.00', 'font_color': 'blue'}),
        'judge_id': workbook.add_format({'num_format': '#,##0', 'font_color': 'blue'}),
        'headline': workbook.add_format({'bold': True, 'font_color': 'blue', 'bottom': True}),
        'headcol': workbook.add_format({'bold': True, 'font_color': 'blue'}),

        'highlighted_number': workbook.add_format({'num_format': '#,##0.00', 'font_color': 'blue', 'border': True, 'bg_color': '#DDDDDD'}),
    }

    for mode, d in data.items():
        sheet = workbook.add_worksheet(mode)
        if mode == 'averaged_scores':
            _write_final_score_sheet(d, sheet, formats)
        else:
            _write_default_data_sheet(d, sheet, formats)

    workbook.close()


def _write_final_score_sheet(d, sheet, formats):
    placing = dict(enumerate(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']))
    header = d['header']
    sheet_data = d['data']

    sheet.write(0, 0, d.get('title_line'), formats['headline'])

    for idx, field in enumerate(header):
        sheet.write(1, idx, field, formats['headline'])


    sheet.set_column(1, 1, 25)
    sheet.set_column(3, 5, 10)
    for row_idx, row_data in enumerate(sheet_data):

        for col_idx, field in enumerate(header):
            if col_idx == 0:
                val = placing.get(row_data.get('Ranking', ''))
                f = formats['headcol']
            elif col_idx == 1:
                val = row_data.get(field)
                f = formats['headcol']
            else:
                val = row_data.get(field)
                f = formats['number']
                if val is not None:
                    if val == VAL_MISSED:
                        val = 'M'
                        f = formats['text']
                    else:
                        try:
                            val = float(val)
                        except:
                            pass
            sheet.write(row_idx+2, col_idx, val, f)
    return


def _write_default_data_sheet(d, sheet, formats):
    header = d['header']
    sheet_data = d['data']
    highlight_cells = d.get('highlights', {})

    sheet.write(0, 0, d.get('title_line'), formats['headline'])

    sheet.set_column(0, 0, 25)
    for idx, field in enumerate(header):
        sheet.write(1, idx, field, formats['headline'])

    for row_idx, row_data in enumerate(sheet_data):
        high = highlight_cells.get(row_data['Color'], {}).get(row_data['Judge Id'], [])

        for col_idx, field in enumerate(header):
            if col_idx == 0:
                val = row_data.get(field)
                f = formats['headcol']
            elif field == 'Judge Id':
                val = row_data.get(field)
                f = formats['judge_id']
                try:
                    val = int(val)
                except:
                    pass
            else:
                val = row_data.get(field)
                f = formats['number']
                if val is not None:
                    if val == VAL_MISSED:
                        val = 'M'
                        f = formats['text']
                    else:
                        try:
                            val = float(val)
                        except:
                            pass
                        if field in high:
                            f = formats['highlighted_number']
            sheet.write(row_idx+2, col_idx, val, f)
    return
