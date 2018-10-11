/* =========================================================
 * heat.js
 * =========================================================
 * Copyright 2016 Dario Goetz
 * ========================================================= */

(function($, undefined){
    $.widget('surfjudge.edit_heat', {
        options: {
            heat_id: null,
            category_id: null,
            data: null,
            show_delete_btn: true,
            geturl: '/rest/heats',
            posturl: '/rest/heats',
            deleteurl: '/rest/heats',
        },

        _create: function(){
            this.data = this.options.data || {};

            if (!this._check_inputs()){
                console.log('Inputs of edit_heat module not valid.');
                return;
            }

            this._init_html();

            this._register_events();
            if (this.options.heat_id !== null)
                this._initialized = this.refresh(true);
            else
                this._initialized = $.Deferred().resolve().promise();
        },

        _destroy: function(){
            this.element.empty();
        },

        _check_inputs: function(){
            if (this.options.heat_id === null
                && this.options.category_id === null)
                // new heat, but category unspecified
                return false;
            return true;
        },

        _init_html: function(){
            var _this = this;
            html = [
                '<div class="alert dirty_marker">',
                '    <div class="form-group row">',
                '        <label class="col-2 col-form-label">Heat name</label>',
                '        <div class="col-10">',
                '            <input type="hidden" class="heat_input" data-key="id">',
                '            <input type="text" name="heat_input_name" class="form-control heat_input" data-key="name" placeholder="Heat Name">',
                '        </div>',
                '    </div>',
                '    <div class="form-group row">',
                '        <label class="col-2 col-form-label">Date</label>',
	            '        <div class="col-5 input-group date">',
	            '            <input class="form-control heat_input" data-key="date" type="text" placeholder="Date start" readonly>',
	            '            <span class="input-group-addon add-on"><i class="fa fa-calendar-alt"></i></span>',
	            '        </div>',
                '        <div class="col-5 input-group bootstrap-timepicker timepicker">',
                '            <input class="form-control time heat_input" data-minute-step="15" data-show-meridian="false" data-key="start_time" type="text">',
	            '            <span class="input-group-addon add-on"><i class="fa fa-clock"></i></span>',
                '        </div>',
                '    </div>',
                '    <div class="form-group row">',
                '        <label class="col-2 col-form-label">Number of waves</label>',
                '        <div class="col-10 input-group plusminusinput">',
                '            <span class="input-group-btn">',
                '                <button type="button" class="btn btn-danger btn-number" data-type="minus" data-field="nwaves">',
                '                    <span class="fa fa-minus"></span>',
                '                </button>',
                '            </span>',
                '            <input type="text" name="nwaves" class="form-control input-number heat_input" data-key="number_of_waves" placeholder="10" min="1" max="100" value="10">',
                '            <span class="input-group-btn">',
                '                <button type="button" class="btn btn-success btn-number" data-type="plus" data-field="nwaves">',
                '                    <span class="fa fa-plus"></span>',
                '                </button>',
                '            </span>',
                '        </div>',
                '    </div>',
                '    <div class="form-group row">',
                '        <label class="col-2 col-form-label">Duration [min]</label>',
                '        <div class="col-10 input-group plusminusinput">',
                '            <span class="input-group-btn">',
                '                <button type="button" class="btn btn-danger btn-number" data-type="minus" data-field="duration">',
                '                     <span class="fa fa-minus"></span>',
                '                </button>',
                '            </span>',
                '            <input type="text" name="duration" class="form-control input-number heat_input" data-key="duration" placeholder="15" min="1" max="120" value="10">',
                '            <span class="input-group-btn">',
                '                <button type="button" class="btn btn-success btn-number" data-type="plus" data-field="duration">',
                '                    <span class="fa fa-plus"></span>',
                '                </button>',
                '            </span>',
                '        </div>',
                '    </div>',
                '    <div class="form-group row">',
                '        <label class="col-2 col-form-label">Additional Info</label>',
                '        <div class="col-10">',
                '            <input type="text" name="input_additional_info" class="form-control heat_input" data-key="additional_info" placeholder="Additional Info">',
                '        </div>',
                '    </div>',
                '    <button type="button" class="btn btn-danger delete_btn">Delete</button>',
                '    <div class="float-right">',
                '        <button type="button" class="btn btn-light reset_btn">Reset</button>',
                '        <button type="button" class="btn btn-primary save_changes_btn">Save changes</button>',
                '    </div>',
                '</div>',
            ].join(' ');

            this.element.append(html);

            if (!this.options.show_delete_btn)
                this.element.find('.delete_btn').remove();

            // ***** plusminus buttons *****
            this.element.find('.plusminusinput').plusminusinput();

            // ***** DATEPICKER *****
            this.element.find('.date').datepicker({
                weekStart: 1,
                autoclose: true,
                format: 'yyyy-mm-dd',
                todayHighlight: true,
            })
            this.element.find('.date').datepicker('setDate', this.data['date'] || new Date());

            // ****** time picker ******
            this.element.find('.time').timepicker();
        },

        _register_events: function(){

            this._on(this.element, {
                'click .reset_btn': this.refresh,
                'click .delete_btn': this.delete_heat,
                'click .save_changes_btn': this.upload,
                'change': this._mark_dirty,
            });
        },

        refresh: function(){
            var _this = this;
            var deferred = $.Deferred();
            if (this.options.heat_id !== null){
                $.getJSON(this.options.geturl + '/' + this.options.heat_id)
                    .done(function(ev_heat_info){
                        if ($.isEmptyObject(ev_heat_info)){
                            console.log('Heat not found.');
                            _this.options.heat_id = null;
                            _this._mark_clean();
                            deferred.reject();
                        } else {
                            _this.data = ev_heat_info;

                            _this.data['number_of_waves'] = _this.data['number_of_waves'] || 10;
                            _this.data['duration'] = _this.data['duration'] || 15;
                            var dt_split = _this.data['start_datetime'].split('T');
                            if (dt_split.length > 1) {
                                _this.data['date'] = dt_split[0];
                                _this.data['start_time'] = dt_split[1].split(':').slice(0,2).join(':');
                            }

                            _this._refresh();
                            _this._mark_clean();
                            deferred.resolve();
                        }
                    })
                    .fail(function(){
                        console.log('Connection error.');
                        deferred.reject();
                    });
            } else {
                console.log('Nothing to refresh (no heat id specified)');
                this._mark_clean;
                deferred.reject();
            }
            return deferred.promise();
        },

        _refresh: function(){
            var _this = this;

            this.element.find('.heat_input').each(function(idx, elem){
                var key = $(this).data('key');
                if (key == 'date'){
                    _this.element.find('.date').datepicker('setDate', _this.data[key] || new Date());
                }
                else if (key == 'start_time'){
                    var val = _this.data['start_time'];
                    if (val != null)
                        $(this).timepicker('setTime', val);
                } else {
                    $(this).val(_this.data[key]);
                }
            });
        },

        upload: function(){
            var _this = this;
            this._fetch_details_from_inputs();
            if (!this._check_data()){
                console.log('Upload failed due to data check');
                return;
            }

            if (this.options.heat_id === null){
                this.data['category_id'] = this.options.category_id;
            }

            console.log('Uploading');
            var deferred = $.Deferred();
            var data = $.extend({}, this.data);
            this.data['start_datetime'] = this.data['date'] + 'T' + this.data['start_time'] + ':00';
            $.post(this.options.posturl, JSON.stringify(this.data), function(heat){
                _this.options.heat_id = heat['id'];
                _this.refresh();
                _this._trigger('data_changed', null);
                deferred.resolve();
            })
                .fail(function(ev){
                    console.log('Connection error');
                    deferred.reject();
                });
            return deferred.promise();
        },

        delete_heat: function(){
            var _this = this;
            var deferred = $.Deferred();
            if (this.options.heat_id !== null) {
                $.ajax({
                    url: this.options.deleteurl + '/' + this.options.heat_id,
                    type: 'DELETE',
                })
                .done(function(){
                    console.log("deleted heat " + _this.options.heat_id);
                    // initialize module as empty
                    _this.options.category_id = _this.options.category_id || _this.data['category_id'];
                    _this.options.heat_id = null;
                    _this.data = {};
                    _this._refresh();
                    _this._trigger('deleted');
                    _this._trigger('data_changed');
                    deferred.resolve();
                })
                .fail(function(){
                    console.log('Connection error.');
                    deferred.reject();
                });
            } else {
                console.log('No heat id specified.');
                deferred.reject();
            }
            return deferred.promise();
        },

        get_data: function(){
            this._fetch_details_from_inputs();
            return $.extend({}, this.data);
        },

        _fetch_details_from_inputs: function(){
            var _this = this;
            this.element.find('.heat_input').each(function(idx, elem){
                _this.data[$(this).data('key')] = $(this).val();
            });

            if (this.data['number_of_waves'] === '')
                this.data['number_of_waves'] = 10;
        },

        _check_data: function(){
            if (this.data['name'].length == 0) {
                alert('Empty field "Heat Name"');
                return false;
            };
            return true;
        },

        initialized: function(){
            return this._initialized;
        },

        _mark_dirty: function(){
            this.element.find('.dirty_marker').addClass('alert-danger');
        },

        _mark_clean: function(){
            this.element.find('.dirty_marker').removeClass('alert-danger');
        },

    });
}(jQuery));
