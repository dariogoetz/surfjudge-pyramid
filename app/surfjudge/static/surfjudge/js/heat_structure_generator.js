/* =========================================================
 * heat_structure_generator.js
 * =========================================================
 * Copyright 2019 Dario Goetz
 * ========================================================= */
(function($, undefined){

    $.widget('surfjudge.generate_heats', {
        options: {
            category_id: null,
            postheaturl: '/rest/heats',
            postadvancementsurl: '/rest/advancements',
            postsurferurl: '/rest/surfers',
            putparticipantsurl: '/rest/participants/{heatid}',
            getlycracolorsurl: '/rest/lycra_colors',
            heatchart_width: 520,
            margin_left: 0,
            margin_right: 0,
            margin_top: 0,
            margin_bottom: 0,

            types:  [
                {key: 'standard', label: 'Standard'},
                {key: 'rsl', label: 'Rapid Surf League'},
            ],
        },

        _create: function(){
            var _this = this;
            this.use_absolute_seeds = false;
            this.generator = null;

            this.lycra_colors = null; // used for preview in Tournamentgenerator

            var deferred = $.Deferred();
            $.get(this.options.getlycracolorsurl)
                .done(function(lycra_colors){
                    _this.lycra_colors = lycra_colors;
                    deferred.resolve();
                })
                .fail(function(){
                    deferred.resolve();
                });
            this.deferred_lycra_colors = deferred.promise();

            this._init_html();
            this._register_events();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
           var _this = this;
           var html = $([
                '<div class="form-horizontal">',
                '  <div class="form-group">',
                '    <div class="row">',
                '      <label class="col-4">Type</label>',
                '      <div class="col-4">',
                '        <select class="form-control type_select" data-field="type"></select>',
                '      </div>',
                '    </div>',
                '    <div class="row">',
                '      <label class="col-4">Number of rounds</label>',
                '      <div class="col-4">',
                '        <div class="input-group plusminusinput">',
                '          <span class="input-group-btn">',
                '            <button type="button" class="btn btn-danger btn-number" data-type="minus" data-field="nheats">',
                '              <span class="fa fa-minus"></span>',
                '            </button>',
                '          </span>',
                '          <input type="text" name="nheats" class="form-control input-number" data-key="nheats" placeholder="3" min="1" max="100" value="2">',
                '          <span class="input-group-btn">',
                '            <button type="button" class="btn btn-success btn-number" data-type="plus" data-field="nheats">',
                '              <span class="fa fa-plus"></span>',
                '            </button>',
                '          </span>',
                '        </div>',
                '      </div>',
                '      <div class="col-4">',
                '        <div class="float-right">',
                '          <button type="button" class="btn btn-secondary upload_csv">Load CSV</button>',
                '          <div class="form-check">',
                '            <input type="checkbox" class="form-check-input use_absolute_seeds">',
                '            <label class="form-check-label">Use absolute seeds</label>',
                '          </div>',
                '        </div>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</div>',
                '<h4>Preview</h4>',
                '<div class="preview_heatchart">',
                '</div>',
                '<div class="float-right">',
                '  <button type="button" class="btn btn-secondary clear_csv" disabled>Reset</button>',
                '  <button type="button" class="btn btn-primary upload_btn" disabled>Save Changes</button>',
                '</div>',

            ].join(' '));

            this.element.append(html);

            // ***** plusminus buttons *****
            this.element.find('.plusminusinput').plusminusinput();

            var type_menu = this.element.find('.type_select');
            type_menu.empty();
            $.each(this.options.types, function(idx, type_pair){
                type_menu.append('<option data-value="{0}">{1}</option>'.format(type_pair['key'], type_pair['label']));
            });

            this.generate_chart();
        },

        _register_events: function(){
            this._on(this.element, {
                'click .upload_btn': this.upload,
                'change .input-number': this.generate_chart,
                'click .upload_csv': this._show_upload_csv_widget,
                'click .clear_csv': this._clear_csv_data,
                'change .use_absolute_seeds': this._toggle_use_absolute,
                'change .type_select': this.generate_chart,
            });
        },

        _toggle_use_absolute: function() {
            this.use_absolute_seeds = this.element.find('.use_absolute_seeds').is(":checked");
            this.generate_chart();
        },

        _clear_csv_data: function(){
            var $btn = this.element.find('.clear_csv');
            if ($btn.attr('disabled')) {
                return;
            } else {
                this.element.find('.upload_csv').data('participants', null);
                $btn.attr('disabled', true);
                this.generate_chart();
            }
        },

        _show_upload_csv_widget: function() {
            var _this = this;
            var html = $([
                '<div class="upload_widget"></div>',
            ].join(' '));
            var bb = bootbox.dialog({
                title: 'Upload Category Partcicipants',
                size: 'large',
                message: html,
                onEscape: true,
                buttons: {
                    'cancel': {
                        label: 'Cancel',
                        className: 'btn btn-default',
                    }
                }
            });

            bb.init(function(){
                bb.find('.upload_widget').csv_upload({
                    required_columns: ['seed', 'first_name', 'last_name'],
                    expected_columns: ['seed', 'first_name', 'last_name'],
                    delimiter: "", // auto
                });
                bb.find('.upload_widget').on('csv_uploaddata_changed', function(ev, data, b, c){
                    // feed upload_data to heatchart / tournament_generator
                    data['data'].sort(function(a, b) {
                        return a['seed'] - b['seed'];
                    });
                    _this.element.find('.upload_csv').data('participants', data['data']);
                    _this.generate_chart();
                    _this.element.find('.clear_csv').attr('disabled', false);
                    bb.modal('hide');
                });
            });
        },

        generate_chart: function(){
            var _this = this;
            this.deferred_lycra_colors.done(function(){
                _this._generate_chart();
            });
        },

        _generate_chart: function(){
            var n_rounds = this.element.find('.input-number').val();
            var participant_data = this.element.find('.upload_csv').data('participants');
            var generator_type = this.element.find('.type_select > option:selected').data('value');

            var generator_options = {
                postheaturl: this.options.postheaturl,
                postadvancementsurl: this.options.postadvancementsurl,
                postsurferurl: this.options.postsurferurl,
                putparticipantsurl: this.options.putparticipantsurl,
                getlycracolorsurl: this.options.getlycracolorsurl,
                preview_lycra_colors: this.lycra_colors,
            };

            if (generator_type == 'standard') {
                this.generator = new StandardTournamentGenerator(generator_options)
            } else {
                this.generator = new RSLTournamentGenerator(generator_options);
            }

            var heatchart_data = this.generator.generate_heatchart_data(n_rounds, participant_data, !this.use_absolute_seeds);

            var heatchart_elem = this.element.find('.preview_heatchart');
            if (heatchart_elem.data('surfjudgeHeatchart') != null)
                heatchart_elem.heatchart('destroy');
            heatchart_data['websocket_url'] = null;
            heatchart_data['use_websocket'] = false;
            heatchart_data['width'] = this.options.heatchart_width;
            heatchart_data['margin_left'] = this.options['margin_left'];
            heatchart_data['margin_right'] = this.options['margin_right'];
            heatchart_data['margin_top'] = this.options['margin_top'];
            heatchart_data['margin_bottom'] = this.options['margin_bottom'];
            heatchart_elem.heatchart(heatchart_data);

            this._activate_upload_btn();
        },

        _activate_upload_btn: function(){
            if (this.generator.heatchart_data != null)
                this.element.find('.upload_btn').attr('disabled', false);
            else
                this.element.find('.upload_btn').attr('disabled', true);
        },

        upload: function(){
            var _this = this;
            if (this.generator.heatchart_data != null && this.options.category_id != null){
                var deferred = this.generator.upload(this.options.category_id);
                deferred.done(function(){
                    _this._trigger('data_changed');
                });
            } else {
            }
        },
    });
}(jQuery));
